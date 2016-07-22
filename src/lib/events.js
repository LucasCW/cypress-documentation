import { EventEmitter } from 'events'
import { action } from 'mobx'

const localBus = new EventEmitter()

export default {
  init ({ appState, runnablesStore, statsStore }) {
    this.appState = appState
    this.runnablesStore = runnablesStore
    this.statsStore = statsStore
  },

  listen (runner) {
    const { appState, runnablesStore, statsStore } = this

    runner.on('runnables:ready', action('runnables:ready', (rootRunnable = {}) => {
      runnablesStore.setRunnables(rootRunnable)
    }))

    runner.on('reporter:log:add', action('log:add', (log) => {
      runnablesStore.addLog(log)
    }))

    runner.on('reporter:log:state:changed', action('log:update', (log) => {
      runnablesStore.updateLog(log)
    }))

    runner.on('reporter:restart:test:run', action('restart:test:run', () => {
      appState.reset()
      runnablesStore.reset()
      statsStore.reset()
      runner.emit('reporter:restarted')
    }))

    runner.on('run:start', action('run:start', () => {
      if (runnablesStore.hasTests) {
        appState.startRunning()
      }
    }))

    runner.on('reporter:start', action('start', (startInfo) => {
      statsStore.start(startInfo)
    }))

    runner.on('test:before:run', action('test:before:run', (runnable) => {
      runnablesStore.runnableStarted(runnable)
    }))

    runner.on('test:after:run', action('test:after:run', (runnable) => {
      runnablesStore.runnableFinished(runnable)
      statsStore.incrementCount(runnable.state)
    }))

    runner.on('paused', action('paused', (nextCommandName) => {
      appState.pause(nextCommandName)
      statsStore.pause()
    }))

    runner.on('run:end', action('run:end', () => {
      appState.stop()
      statsStore.stop()
    }))

    localBus.on('resume', action('resume', () => {
      appState.resume()
      statsStore.resume()
      runner.emit('runner:resume')
    }))

    localBus.on('next', action('next', () => {
      runner.emit('runner:next')
    }))

    localBus.on('stop', action('stop', () => {
      runner.emit('runner:abort')
    }))

    localBus.on('restart', action('restart', () => {
      runner.emit('runner:restart')
    }))

    localBus.on('show:command', (commandId) => {
      runner.emit('runner:console:log', commandId)
    })

    localBus.on('show:error', (testId) => {
      const test = runnablesStore.testById(testId)
      if (test.err.isCommandErr) {
        const command = test.commandMatchingErr()
        if (!command) return
        runner.emit('runner:console:log', command.id)
      } else {
        runner.emit('runner:console:error', testId)
      }
    })

    localBus.on('show:snapshot', (commandId) => {
      runner.emit('runner:show:snapshot', commandId)
    })

    localBus.on('hide:snapshot', (commandId) => {
      runner.emit('runner:hide:snapshot', commandId)
    })

    localBus.on('focus:tests', () => {
      runner.emit('focus:tests')
    })
  },

  emit (event, ...args) {
    localBus.emit(event, ...args)
  },

  // for testing purposes
  __off () {
    localBus.removeAllListeners()
  },
}
