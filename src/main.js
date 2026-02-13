import './style.css'
import Phaser from 'phaser'

// Fixed game viewport; scaled to fit the browser.
const GAME_WIDTH = 320
const GAME_HEIGHT = 180
// Movement and gravity tuning values.
const PLAYER_SPEED = 125
const GRAVITY_Y = 900
// Bottom padding baked into each frame that we want to crop out.
const SPRITE_BOTTOM_PAD = 3
const GROUND_HEIGHT = 32
// Animation tuning.
const WALK_FRAME_RATE = 6
const IDLE_FRAME_RATE = 4
// Frame ranges exported from Aseprite tags.
const WALK_FRAMES = { from: 0, to: 5 }
const IDLE_FRAMES = { from: 6, to: 10 }
const HELD_FRAMES = { from: 11, to: 11 }
const JUMP_FRAMES = { from: 12, to: 12 }
const FALL_FRAMES = { from: 13, to: 13 }
const BALLOON_FLOAT_FRAMES = { from: 0, to: 3 }
const BALLOON_HELD_FRAME = 4
const BALLOON_FLOAT_RATE = 6
const BALLOON_Y_OFFSET = 26
const BALLOON_HELD_OFFSET = { x: 7, y: -10 }
const FLOAT_SPEED = 96
const ENVELOP_OFFSET_Y = 100
const ENVELOP_BOB_AMPLITUDE = 6
const ENVELOP_BOB_SPEED = 0.003
const CHEST_OFFSET = 10

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' })
    this.player = null
    this.keys = null
    this.ground = null
    this.playerState = 'idle'
    this.balloon = null
    this.isHoldingBalloon = false
    this.balloonState = 'float'
    this.prevLeftDown = false
    this.prevRightDown = false
    this.balloonHomeX = 0
    this.balloonHomeY = 0
    this.inputState = { left: false, right: false }
    this.inputPaused = false
    this.floatDir = -1
    this.groundTopY = 0
    this.envelope = null
    this.envelopeBaseY = 0
    this.gamePaused = false
    this.promptBackdrop = null
    this.promptImage = null
    this.controlsHelp = null
    this.chest = null
    this.overlayCooldownUntil = 0
  }

  preload() {
    const base = import.meta.env.BASE_URL
    // Load the sprite atlas + metadata exported from Aseprite/LibreSprite.
    this.load.atlas('miffy', `${base}assets/miffy-Sheet.png`, `${base}assets/miffy.json`)
    this.load.atlas(
      'heart_balloon',
      `${base}assets/heart_balloon-Sheet.png`,
      `${base}assets/heart_balloon.json`
    )
    this.load.image('bg', `${base}assets/valentines_background_2026.png`)
    this.load.image('ground', `${base}assets/valentines_ground_2026.png`)
    this.load.image('envelope', `${base}assets/valentines_envelop_2026.png`)
    this.load.image('prompt', `${base}assets/valentine_prompt_2026.png`)
    this.load.image('controls_help', `${base}assets/controls_help.png`)
    this.load.image('chest', `${base}assets/chest.png`)
  }

  create() {
    const bg = this.add.image(0, 0, 'bg').setOrigin(0, 0)
    bg.setDisplaySize(this.scale.width, this.scale.height)

    this.envelope = this.add.image(this.scale.width / 2, ENVELOP_OFFSET_Y, 'envelope')
    this.envelopeBaseY = ENVELOP_OFFSET_Y

    this.promptBackdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.25)
      .setOrigin(0, 0)
      .setAlpha(0)
      .setDepth(50)
    this.promptImage = this.add
      .image(this.scale.width / 2, this.scale.height / 2, 'prompt')
      .setAlpha(0)
      .setDepth(51)
    this.promptImage.setDisplaySize(this.scale.width * 0.8, this.scale.height * 0.8)
    this.controlsHelp = this.add.image(8, 8, 'controls_help').setOrigin(0, 0).setDepth(40).setAlpha(0.1)
    this.controlsHelp.setInteractive({ useHandCursor: true })
    this.controlsHelp.on('pointerover', () => {
      this.controlsHelp.setAlpha(0.4)
    })
    this.controlsHelp.on('pointerout', () => {
      this.controlsHelp.setAlpha(0.1)
    })

    // Spawn the player with a small offset from the bottom-left.
    const offsetX = 80
    const offsetY = 80
    const startX = offsetX
    const startY = this.scale.height - offsetY

    // Define the walk + idle animations from the atlas frames.
    const miffyTexture = this.textures.get('miffy')
    const maxMiffyFrame = Math.max(
      WALK_FRAMES.to,
      IDLE_FRAMES.to,
      HELD_FRAMES.to,
      JUMP_FRAMES.to,
      FALL_FRAMES.to
    )
    const allCroppedFrames = []
    for (let index = 0; index <= maxMiffyFrame; index += 1) {
      const frameName = `miffy ${index}.ase`
      const frame = miffyTexture.get(frameName)
      const croppedName = `miffy ${index}.cropped`
      miffyTexture.add(
        croppedName,
        frame.sourceIndex,
        frame.cutX,
        frame.cutY,
        frame.cutWidth,
        frame.cutHeight - SPRITE_BOTTOM_PAD
      )
      allCroppedFrames[index] = { key: 'miffy', frame: croppedName }
    }

    const walkFrames = allCroppedFrames.slice(WALK_FRAMES.from, WALK_FRAMES.to + 1)
    const idleFrames = allCroppedFrames.slice(IDLE_FRAMES.from, IDLE_FRAMES.to + 1)
    const heldFrames = allCroppedFrames.slice(HELD_FRAMES.from, HELD_FRAMES.to + 1)
    const jumpFrames = allCroppedFrames.slice(JUMP_FRAMES.from, JUMP_FRAMES.to + 1)
    const fallFrames = allCroppedFrames.slice(FALL_FRAMES.from, FALL_FRAMES.to + 1)

    this.anims.create({
      key: 'miffy-walk',
      frames: walkFrames,
      frameRate: WALK_FRAME_RATE,
      repeat: -1
    })

    this.anims.create({
      key: 'miffy-idle',
      frames: idleFrames,
      frameRate: IDLE_FRAME_RATE,
      repeat: -1,
      yoyo: true
    })

    this.anims.create({
      key: 'miffy-held',
      frames: heldFrames,
      frameRate: 1,
      repeat: -1
    })

    this.anims.create({
      key: 'miffy-jump',
      frames: jumpFrames,
      frameRate: 1,
      repeat: -1
    })

    this.anims.create({
      key: 'miffy-fall',
      frames: fallFrames,
      frameRate: 1,
      repeat: -1
    })

    const balloonFrames = []
    for (let index = BALLOON_FLOAT_FRAMES.from; index <= BALLOON_FLOAT_FRAMES.to; index += 1) {
      balloonFrames.push({ key: 'heart_balloon', frame: `heart_balloon ${index}.ase` })
    }

    this.anims.create({
      key: 'float',
      frames: balloonFrames,
      frameRate: BALLOON_FLOAT_RATE,
      repeat: -1
    })

    this.anims.create({
      key: 'held',
      frames: [{ key: 'heart_balloon', frame: `heart_balloon ${BALLOON_HELD_FRAME}.ase` }],
      frameRate: 1,
      repeat: -1
    })
    // Create a static ground platform using the ground texture.
    this.ground = this.add.image(
      this.scale.width / 2,
      this.scale.height - GROUND_HEIGHT / 2,
      'ground'
    )
    this.ground.setDisplaySize(this.scale.width, GROUND_HEIGHT)
    this.physics.add.existing(this.ground, true)

    // Create the player physics sprite and enable collisions.
    this.player = this.physics.add
      .sprite(startX, startY, 'miffy', 'miffy 0.cropped')
      .setCollideWorldBounds(true)
    this.player.play('miffy-idle')
    this.playerState = 'idle'
    console.log('[state] miffy -> idle')
    this.player.body.setGravityY(GRAVITY_Y)
    this.physics.add.collider(this.player, this.ground)

    // Spawn with a visual offset so the feet sit on the ground art.
    const groundTop = this.scale.height - GROUND_HEIGHT
    this.player.y = groundTop - this.player.height / 2
    this.groundTopY = groundTop
    this.chest = this.add.image(0, 0, 'chest')
    this.chest.x = this.scale.width - CHEST_OFFSET - this.chest.width / 2
    this.chest.y = groundTop - this.chest.height / 2

    // Place the balloon in the center, above the ground.
    this.balloon = this.physics.add.sprite(
      this.scale.width / 2,
      groundTop - BALLOON_Y_OFFSET,
      'heart_balloon'
    )
    this.balloonHomeX = this.balloon.x
    this.balloonHomeY = this.balloon.y
    this.balloon.setImmovable(true)
    this.balloon.body.setAllowGravity(false)
    this.isHoldingBalloon = false
    this.balloonState = 'float'
    this.balloon.play('float')
    console.log('[state] balloon -> float')

    // WASD + E input mapping.
    this.input.keyboard.enabled = true
    if (this.game?.canvas) {
      this.game.canvas.setAttribute('tabindex', '0')
      this.game.canvas.focus()
    }
    this.keys = {
      up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      interact: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      escape: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    }
    this.input.keyboard.on('keydown-A', () => {
      this.inputState.left = true
      console.log('[input] keydown: A')
    })
    this.input.keyboard.on('keyup-A', () => {
      this.inputState.left = false
      console.log('[input] keyup: A')
    })
    this.input.keyboard.on('keydown-D', () => {
      this.inputState.right = true
      console.log('[input] keydown: D')
    })
    this.input.keyboard.on('keyup-D', () => {
      this.inputState.right = false
      console.log('[input] keyup: D')
    })
    this.input.keyboard.on('keydown', (event) => {
      console.log(`[input] keydown: ${event.code}`)
    })
    this.input.on('pointerdown', () => {
      if (this.game?.canvas) {
        this.game.canvas.focus()
      }
    })
    this.input.on('gameout', () => {
      this.inputPaused = true
      this.inputState.left = false
      this.inputState.right = false
      console.log('[input] gameout')
    })
    this.input.on('gameover', () => {
      this.inputPaused = false
      console.log('[input] gameover')
    })
  }


  update(_, delta) {
    if (!this.player || !this.keys) return
    if (this.gamePaused) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.escape)) {
        this.tweens.add({
          targets: [this.promptBackdrop, this.promptImage],
          alpha: 0,
          duration: 300,
          ease: 'Sine.easeIn',
          onComplete: () => {
            this.physics.world.resume()
            this.gamePaused = false
            this.overlayCooldownUntil = this.time.now + 5000
          }
        })
      }
      return
    }
    if (this.envelope) {
      this.envelope.y =
        this.envelopeBaseY + Math.sin(this.time.now * ENVELOP_BOB_SPEED) * ENVELOP_BOB_AMPLITUDE
    }

    if (this.isHoldingBalloon && this.envelope && this.time.now >= this.overlayCooldownUntil) {
      const playerBounds = this.player.getBounds()
      const envelopeBounds = this.envelope.getBounds()
      Phaser.Geom.Rectangle.Inflate(envelopeBounds, 12, 12)
      const intersects = Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, envelopeBounds)
      if (intersects) {
        this.gamePaused = true
        this.physics.world.pause()
        this.promptBackdrop.setAlpha(0)
        this.promptImage.setAlpha(0)
        this.tweens.add({
          targets: [this.promptBackdrop, this.promptImage],
          alpha: 1,
          duration: 400,
          ease: 'Sine.easeOut'
        })
        return
      }
    }
    if (this.inputPaused) {
      this.player.setVelocityX(0)
      if (!this.isHoldingBalloon && this.playerState !== 'idle') {
        this.player.play('miffy-idle', true)
        this.playerState = 'idle'
        console.log('[state] miffy -> idle')
      }
      return
    }

    const leftDown = this.inputState.left
    const rightDown = this.inputState.right
    if (leftDown !== this.prevLeftDown) {
      console.log(`[input] left.isDown = ${leftDown}`)
      this.prevLeftDown = leftDown
    }
    if (rightDown !== this.prevRightDown) {
      console.log(`[input] right.isDown = ${rightDown}`)
      this.prevRightDown = rightDown
    }

    // Horizontal movement.
    const speedFactor = this.isHoldingBalloon ? 0.5 : 1
    let vx = 0
    if (leftDown) vx -= PLAYER_SPEED * speedFactor
    if (rightDown) vx += PLAYER_SPEED * speedFactor
    this.player.setVelocityX(vx)

    const canGrab =
      this.balloon &&
      !this.isHoldingBalloon &&
      this.physics.overlap(this.player, this.balloon)
    if (this.keys.interact && Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
      if (this.isHoldingBalloon) {
        this.isHoldingBalloon = false
        this.balloonState = 'float'
        this.balloon.play('float', true)
        this.balloon.x = this.balloonHomeX
        this.balloon.y = this.balloonHomeY
        this.playerState = 'idle'
        this.player.body.setAllowGravity(true)
        console.log('[state] balloon -> float')
        console.log('[state] miffy -> idle')
      } else if (canGrab) {
        this.isHoldingBalloon = true
        this.balloonState = 'held'
        this.balloon.play('held', true)
        this.player.play('miffy-held', true)
        this.player.body.setAllowGravity(false)
        this.player.setVelocityY(0)
        this.floatDir = -1
        console.log('[state] balloon -> held')
      }
    }

    if (this.isHoldingBalloon && this.balloon) {
      const offsetX = this.player.flipX ? -BALLOON_HELD_OFFSET.x : BALLOON_HELD_OFFSET.x
      this.balloon.x = this.player.x + offsetX
      this.balloon.y = this.player.y + BALLOON_HELD_OFFSET.y
      this.balloonHomeX = this.balloon.x
    }

    if (vx > 0) {
      this.player.setFlipX(false)
    } else if (vx < 0) {
      this.player.setFlipX(true)
    }

    if (!this.isHoldingBalloon) {
      const vy = this.player.body?.velocity?.y ?? 0
      if (vy < 0) {
        if (this.playerState !== 'jump') {
          this.player.play('miffy-jump', true)
          this.playerState = 'jump'
          console.log('[state] miffy -> jump')
        }
      } else if (vy > 0) {
        if (this.playerState !== 'fall') {
          this.player.play('miffy-fall', true)
          this.playerState = 'fall'
          console.log('[state] miffy -> fall')
        }
      } else {
        const moving = leftDown || rightDown
        if (moving) {
          if (this.playerState !== 'walk') {
            this.player.play('miffy-walk', true)
            this.playerState = 'walk'
            console.log('[state] miffy -> walk')
          }
        } else if (this.playerState !== 'idle') {
          this.player.play('miffy-idle', true)
          this.playerState = 'idle'
          console.log('[state] miffy -> idle')
        }
      }
    } else if (this.playerState !== 'held') {
      this.player.play('miffy-held', true)
      this.playerState = 'held'
      console.log('[state] miffy -> held')
    }

    if (!this.isHoldingBalloon) {
      // Jump only when grounded.
      const onGround = this.player.body.blocked.down
      if (onGround && this.keys.up.isDown) {
        this.player.setVelocityY(-380)
      }
    } else {
      this.player.setVelocityY(0)
      const topY = this.player.height / 2
      const bottomY = this.groundTopY - this.player.height / 2
      this.player.y += this.floatDir * FLOAT_SPEED * (delta / 1000)
      if (this.player.y <= topY) {
        this.player.y = topY
        this.floatDir = 1
      } else if (this.player.y >= bottomY) {
        this.player.y = bottomY
        this.isHoldingBalloon = false
        this.balloonState = 'float'
        this.balloon.play('float', true)
        this.balloon.x = this.balloonHomeX
        this.balloon.y = this.balloonHomeY
        this.playerState = 'idle'
        this.player.body.setAllowGravity(true)
        this.floatDir = -1
        console.log('[state] balloon -> float')
        console.log('[state] miffy -> idle')
      }
    }
  }
}

// Boot the game with arcade physics and a fixed-size viewport.
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0b0b0b',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scene: [MainScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: Phaser.Scale.MAX_ZOOM,
    autoRound: true
  },
  render: {
    pixelArt: true,
    roundPixels: true
  }
})
