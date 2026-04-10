/**
 * Leica DISTO S910 — Web Bluetooth Integration
 *
 * Connects to Leica DISTO laser distance meters via BLE.
 * Receives measurements and auto-fills into dimension inputs.
 *
 * Supported: Chrome/Edge on HTTPS or localhost
 * Tested with: DISTO S910 (should work with D1, D2, D510 too)
 *
 * BLE GATT UUIDs (community reverse-engineered):
 * - Service:   3ab10100-f831-4395-b29d-570977d5bf94
 * - Write:     3ab10101-f831-4395-b29d-570977d5bf94  (trigger measurement)
 * - Notify:    3ab10102-f831-4395-b29d-570977d5bf94  (receive distance)
 */

import { useState, useRef, useCallback, useEffect } from 'react'

const DISTO_SERVICE_UUID  = '3ab10100-f831-4395-b29d-570977d5bf94'
const DISTO_WRITE_UUID    = '3ab10101-f831-4395-b29d-570977d5bf94'
const DISTO_NOTIFY_UUID   = '3ab10102-f831-4395-b29d-570977d5bf94'

// Command to trigger single measurement
const CMD_MEASURE = new Uint8Array([0x67]) // 'g'

export type DistoStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface DistoState {
  status: DistoStatus
  deviceName: string | null
  lastMeasurement: number | null    // mm
  error: string | null
}

export interface UseLeicaDistoReturn extends DistoState {
  connect: (scanAll?: boolean) => Promise<void>
  disconnect: () => void
  triggerMeasure: () => Promise<void>
  isSupported: boolean
  onMeasurement: (callback: (distanceMM: number) => void) => void
}

export function useLeicaDisto(): UseLeicaDistoReturn {
  const [state, setState] = useState<DistoState>({
    status: 'disconnected',
    deviceName: null,
    lastMeasurement: null,
    error: null,
  })

  const deviceRef = useRef<BluetoothDevice | null>(null)
  const serverRef = useRef<BluetoothRemoteGATTServer | null>(null)
  const writeCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  const notifyCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  const callbackRef = useRef<((distanceMM: number) => void) | null>(null)

  const isSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator

  const handleMeasurement = useCallback((event: Event) => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic
    const value = characteristic.value
    if (!value) return

    // Leica DISTO sends distance as float32 little-endian in meters
    // Try float32 first (standard format)
    let distanceM: number

    if (value.byteLength >= 4) {
      distanceM = value.getFloat32(0, true) // little-endian
    } else if (value.byteLength >= 2) {
      // Some models send uint16 in mm
      distanceM = value.getUint16(0, true) / 1000
    } else {
      console.warn('[DISTO] Unexpected data length:', value.byteLength)
      return
    }

    // Convert to mm (our app uses mm)
    const distanceMM = Math.round(distanceM * 1000)

    // Sanity check: 10mm to 300000mm (300m — S910 max range is 300m)
    if (distanceMM < 10 || distanceMM > 300000) {
      console.warn('[DISTO] Out of range measurement:', distanceMM, 'mm')
      return
    }

    console.log(`[DISTO] Measurement: ${distanceMM} mm (${distanceM.toFixed(4)} m)`)

    setState(s => ({ ...s, lastMeasurement: distanceMM }))

    // Fire callback to auto-fill dimension
    if (callbackRef.current) {
      callbackRef.current(distanceMM)
    }
  }, [])

  const connect = useCallback(async (scanAll = false) => {
    if (!isSupported) {
      setState(s => ({ ...s, status: 'error', error: 'Web Bluetooth not supported. Use Chrome/Edge.' }))
      return
    }

    setState(s => ({ ...s, status: 'connecting', error: null }))

    try {
      // Request device — user picks from popup
      // scanAll=true shows ALL Bluetooth devices (useful when device name is unknown)
      const requestOptions: RequestDeviceOptions = scanAll
        ? {
            acceptAllDevices: true,
            optionalServices: [DISTO_SERVICE_UUID],
          }
        : {
            filters: [
              { namePrefix: 'DISTO' },
              { namePrefix: 'Leica' },
              { namePrefix: 'S910' },
              { services: [DISTO_SERVICE_UUID] },
            ],
            optionalServices: [DISTO_SERVICE_UUID],
          }

      const device = await navigator.bluetooth.requestDevice(requestOptions as any)

      deviceRef.current = device
      setState(s => ({ ...s, deviceName: device.name || 'DISTO' }))

      // Handle disconnection
      device.addEventListener('gattserverdisconnected', () => {
        console.log('[DISTO] Disconnected')
        setState(s => ({
          ...s,
          status: 'disconnected',
          deviceName: null,
        }))
        serverRef.current = null
        writeCharRef.current = null
        notifyCharRef.current = null
      })

      // Connect GATT server
      const server = await device.gatt!.connect()
      serverRef.current = server

      // Get DISTO service
      const service = await server.getPrimaryService(DISTO_SERVICE_UUID)

      // Get write characteristic (for triggering measurements)
      try {
        const writeChar = await service.getCharacteristic(DISTO_WRITE_UUID)
        writeCharRef.current = writeChar
      } catch (e) {
        console.warn('[DISTO] Write characteristic not found — remote trigger unavailable')
      }

      // Get notify characteristic (for receiving measurements)
      const notifyChar = await service.getCharacteristic(DISTO_NOTIFY_UUID)
      notifyCharRef.current = notifyChar

      // Subscribe to measurement notifications
      await notifyChar.startNotifications()
      notifyChar.addEventListener('characteristicvaluechanged', handleMeasurement)

      setState(s => ({ ...s, status: 'connected' }))
      console.log(`[DISTO] Connected to ${device.name}`)

    } catch (err: any) {
      const msg = err?.message || 'Connection failed'
      console.error('[DISTO] Error:', msg)

      // User cancelled = not really an error
      if (msg.includes('cancelled') || msg.includes('canceled')) {
        setState(s => ({ ...s, status: 'disconnected', error: null }))
      } else {
        setState(s => ({ ...s, status: 'error', error: msg }))
      }
    }
  }, [isSupported, handleMeasurement])

  const disconnect = useCallback(() => {
    if (notifyCharRef.current) {
      notifyCharRef.current.removeEventListener('characteristicvaluechanged', handleMeasurement)
      try { notifyCharRef.current.stopNotifications() } catch {}
    }
    if (serverRef.current?.connected) {
      serverRef.current.disconnect()
    }
    deviceRef.current = null
    serverRef.current = null
    writeCharRef.current = null
    notifyCharRef.current = null
    setState({
      status: 'disconnected',
      deviceName: null,
      lastMeasurement: null,
      error: null,
    })
  }, [handleMeasurement])

  const triggerMeasure = useCallback(async () => {
    if (!writeCharRef.current) {
      console.warn('[DISTO] Write characteristic not available — press measure on device')
      return
    }
    try {
      await writeCharRef.current.writeValue(CMD_MEASURE)
      console.log('[DISTO] Measurement triggered')
    } catch (err: any) {
      console.error('[DISTO] Trigger error:', err?.message)
    }
  }, [])

  const onMeasurement = useCallback((callback: (distanceMM: number) => void) => {
    callbackRef.current = callback
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => { disconnect() }
  }, [disconnect])

  return {
    ...state,
    connect,
    disconnect,
    triggerMeasure,
    isSupported,
    onMeasurement,
  }
}
