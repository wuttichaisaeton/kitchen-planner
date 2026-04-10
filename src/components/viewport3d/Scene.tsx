import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Grid } from '@react-three/drei'
import Room3D from './Room3D'
import PlacedItems3D from './PlacedItems3D'
import DropPlane from './DropPlane'

export default function Scene() {
  return (
    <Canvas
      camera={{ position: [3000, 2500, 3000], fov: 50, near: 1, far: 50000 }}
      shadows
      gl={{ preserveDrawingBuffer: true }}
      style={{ background: '#1a1a2e' }}
    >
      <color attach="background" args={['#1a1a2e']} />
      <fog attach="fog" args={['#1a1a2e', 8000, 15000]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[3000, 5000, 3000]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-5000}
        shadow-camera-right={5000}
        shadow-camera-top={5000}
        shadow-camera-bottom={-5000}
      />
      <pointLight position={[2000, 2500, 1500]} intensity={0.6} />
      <Environment preset="apartment" background={false} />
      <Room3D />
      <PlacedItems3D />
      <DropPlane />
      <Grid
        args={[10000, 10000]}
        cellSize={100}
        sectionSize={500}
        fadeDistance={8000}
        cellColor="#333"
        sectionColor="#555"
        position={[2000, 0.5, 1500]}
      />
      <OrbitControls
        target={[2000, 800, 1500]}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={500}
        maxDistance={15000}
      />
    </Canvas>
  )
}
