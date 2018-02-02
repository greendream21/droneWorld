import {Vector2, Vector3} from 'three'
import React, {Component} from 'react'
import ReactDOM from 'react-dom'
import {screenXYclamped} from '../utils'
import PubSub from '../events'
import {scene, camera} from '../index'

let hudHorizon
let hudFocal
let targets = []
const targetsInSight = new Set()
const screenCenter = new Vector2(window.innerWidth / 2, window.innerHeight / 2)

class HUD extends Component {
  componentDidMount () {
    PubSub.publish('x.hud.mounted')
  }

  render () {
    return (
      <div>
        <div id='limiter' />
        <div id='pointer' />
        <div id='focal' />
        <div id='horizon' />
        <svg className='vector'>
          <path d={`M ${screenCenter.x} ${screenCenter.y}
                    v 20 v -40
                    h -15 h 30 h -15 v 20
                    h -5 h 10 h -5 v 20
                    h -15 h 30 h -15
                    `}
            strokeWidth='1'
            stroke='#0f0'
            fill='transparent' />
          {targets.map(target => (
            target.gunHud
            ? (<path
              key={target.id}
              d={`M ${target.hudPosition.x} ${target.hudPosition.y}
                  l ${target.direction.x} ${target.direction.y}
                  l 5 5 l -10 -10 l 5 5 l -5 5 l 10 -10`}
              strokeWidth='1'
              stroke='orange'
              fill='transparent' />)
            : null
          ))}
        </svg>
        <div id='targets'>
          {targets.map(target => (
            <div className='target' key={target.id} id={'target-' + target.id}>
              <div className='life' style={{width: target.life / 100 * 20}} />
              <div className='arrow' />
              <div className='distance' />
              <div className='name' />
            </div>
          ))}
        </div>
      </div>
    )
  }
}

const registerTarget = (msg, target) => {
  targets.push(target)
  hudElement.forceUpdate()
  const targetElement = document.getElementById('target-' + target.id)
  const arrow = targetElement.querySelector('.arrow')
  const distance = targetElement.querySelector('.distance')
  const name = targetElement.querySelector('.name')
  let hudPosition
  let targetDistance2D
  let targetDistance3D
  let targetVector
  let targetDirection
  this.zone = 400
  const targetLoop = (timestamp, delta) => {
    if (!hudElement.mounted) return
    hudPosition = screenXYclamped(target.position)
    if (hudPosition.z > 1) {
      hudPosition.x = window.innerWidth - hudPosition.x
      hudPosition.y = window.innerHeight - 10
      targetElement.style.borderColor = 'red'
      arrow.style.borderBottomColor = 'red'
    } else {
      targetElement.style.borderColor = 'orange'
      arrow.style.borderBottomColor = 'orange'
    }
    target.hudPosition = hudPosition
    targetVector = new Vector2(hudPosition.x, hudPosition.y).sub(screenCenter)
    if (targetVector.length() > this.zone) {
      targetVector.normalize().multiplyScalar(this.zone)
    }
    arrow.style.opacity = 0.8 * (1 - (this.zone - targetVector.length()) / 50)
    targetDistance3D = camera.position.clone().sub(target.position).length()
    distance.innerHTML = targetDistance3D.toFixed(0)
    distance.style.color = targetDistance3D < 300 ? '#0f0' : 'orange'
    name.innerHTML = 'drone-' + target.id
    targetElement.style.transform = `
      translateX(${targetVector.x + screenCenter.x}px)
      translateY(${targetVector.y + screenCenter.y}px)
      scale(${1.1 - Math.min(0.2, targetDistance3D / 2000)})
    `
    arrow.style.transform = `
      translateY(2px)
      rotate(${targetVector.angle() / Math.PI * 180 + 90}deg)
    `
    targetDistance2D = targetVector.length()
    if (!target.destroyed && targetElement.style.borderColor === 'orange' && targetDistance2D < 75) {
      targetElement.style.borderColor = '#0f0'
      targetsInSight.add(target)
    } else {
      targetsInSight.delete(target)
    }
    if (targetDistance2D < this.zone * 0.8) {
      targetDirection = screenXYclamped(
        target.position.clone().add(target.velocity.clone().multiplyScalar(
          Math.min(1, targetDistance3D / 300)
        ))
      )
      target.gunHud = true
      target.direction = {
        x: targetDirection.x - (targetVector.x + screenCenter.x),
        y: targetDirection.y - (targetVector.y + screenCenter.y)
      }
    } else {
      target.gunHud = false
    }
    hudElement.forceUpdate()
  }
  targetLoop.id = target.id
  const destroyTarget = (msg, targetToDestroy) => {
    if (targetToDestroy.id !== target.id) return
    scene.remove(targetToDestroy)
    PubSub.publish('x.loops.remove', targetLoop)
    targets = targets.filter(item => item.id !== targetToDestroy.id)
    targetsInSight.delete(target)
    hudElement.forceUpdate()
  }
  PubSub.subscribe('x.drones.destroy', destroyTarget)
  PubSub.publish('x.loops.push', targetLoop)
}
PubSub.subscribe('x.hud.register.target', registerTarget)

const hudLoop = (timestamp) => {
  const localX = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
  const localY = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
  const rollAngle = (
    Math.PI / 2 - camera.up.angleTo(localX) * Math.sign(camera.up.dot(localY))
  )
  camera.rollAngle = rollAngle
  const pitch = camera.up.dot(camera.getWorldDirection())
  const rollAngleDegree = rollAngle / Math.PI * 180
  hudHorizon.style.transform = `translateX(-50%) translateY(${pitch * window.innerHeight / 2}px) rotate(${rollAngleDegree}deg)`
  if (targetsInSight.size > 0) {
    hudFocal.style.boxShadow = '0 0 75px #0f0'
  } else {
    hudFocal.style.boxShadow = ''
  }
}

PubSub.subscribe('x.hud.mounted', () => {
  hudHorizon = document.getElementById('horizon')
  hudFocal = document.getElementById('focal')
  PubSub.publish('x.loops.push', hudLoop)
  hudElement.mounted = true
})

const selectNearestTargetInSight = () => {
  if (targetsInSight.size === 0) return null
  const distances = []
  targetsInSight.forEach(target =>
    distances.push([camera.position.distanceTo(target.position), target])
  )
  distances.sort((a, b) => a[0] > b[0])
  return distances[0][1]
}

const hudElement = ReactDOM.render(
  <HUD />,
  document.getElementById('hud')
)

export {selectNearestTargetInSight, hudElement, targets}
