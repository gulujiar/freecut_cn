import childProcess from 'node:child_process'

const fakeExec = (cmd, callback) => {
  if (callback) {
    callback(null, '', '')
  }
  return {
    on() {},
    stdout: null,
    stderr: null,
  }
}

childProcess.exec = fakeExec
childProcess.execFile = fakeExec
childProcess.execSync = () => ''

process.argv = ['node', 'vite', '--host']

await import('../node_modules/vite/bin/vite.js')
