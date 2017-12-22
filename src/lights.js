import {
  DirectionalLight,
  DirectionalLightHelper,
  HemisphereLight,
  AmbientLight,
} from 'three'
import {scene} from './index'

const dirLight = new DirectionalLight( 0xffffff, 4);
window.dirLight = dirLight
const hemishpereLight = new HemisphereLight( 0xffffbb, 0x080820, .1 );
const ambientLight = new AmbientLight( 0x404040, 0.1 ); // soft white light

const initLights = (scene, sunPosition) => {
  dirLight.position.copy(sunPosition);
  dirLight.position.normalize()
  dirLight.position.multiplyScalar(2000.0)
  dirLight.up.set(0, 0, 1)
  dirLight.name = "sunlight";

  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = dirLight.shadow.mapSize.height = 1024;
  const d = 1024;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;

  dirLight.shadow.camera.far = 5000;
  dirLight.shadow.bias = -0.0001;
  dirLight.needsUpdate = true

  scene.add(dirLight);
  scene.add(hemishpereLight);
  scene.add(ambientLight);

}

export {initLights, dirLight, hemishpereLight, ambientLight}
