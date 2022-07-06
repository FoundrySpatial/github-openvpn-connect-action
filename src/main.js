const fs = require('fs')
const core = require('@actions/core')
const exec = require('./exec')
const Tail = require('tail').Tail

const run = (callback) => {
  const configFile = core.getInput('config_file').trim()
  const username = core.getInput('username').trim()
  const password = core.getInput('password').trim()
  const clientKey = core.getInput('client_key').trim()
  const caCert = core.getInput('ca_cert').trim()
  const clientCert = core.getInput('client_cert').trim()
  const tlsAuthKey = core.getInput('tls_auth_key').trim()

  if (!fs.existsSync(configFile)) {
    throw new Error(`config file '${configFile}' not found`)
  }

  // 1. Configure client

  fs.appendFileSync(configFile, '\n# ----- modified by action -----\n')

  // username & password auth
  if (username && password) {
    core.debug('Username and Password present, using auth-user-pass')
    fs.appendFileSync(configFile, 'auth-user-pass up.txt\n')
    fs.writeFileSync('up.txt', [username, password].join('\n'))
  }

  // client key
  if (clientKey) {
    core.debug('ClientKey present, using key')
    fs.appendFileSync(configFile, 'key client.key\n')
    fs.writeFileSync('client.key', clientKey)
  }

  // ca certificate auth
  if (caCert) {
    core.debug('Cert Auth present, using ca')
    fs.appendFileSync(configFile, 'ca ca_cert.crt\n')
    fs.writeFileSync('ca_cert.crt', caCert)
  }

  // client certificate
  if (clientCert) {
    core.debug('Client Cert present, using cert')
    fs.appendFileSync(configFile, 'cert client_cert.crt\n')
    fs.writeFileSync('client_cert.crt', clientCert)
  }

  if (tlsAuthKey) {
    core.debug('TLS Auth present, using tls-auth')
    fs.appendFileSync(configFile, 'tls-auth ta.key 1\n')
    fs.writeFileSync('ta.key', tlsAuthKey)
  }

  core.info('========== begin configuration ==========')
  core.info(fs.readFileSync(configFile, 'utf8'))
  core.info('=========== end configuration ===========')

  // 2. Run openvpn

  // prepare log file
  fs.writeFileSync('openvpn.log', '')
  const tail = new Tail('openvpn.log')

  try {
    exec(`sudo openvpn --config ${configFile} --daemon --log openvpn.log --writepid openvpn.pid`)
  } catch (error) {
    core.error(fs.readFileSync('openvpn.log', 'utf8'))
    tail.unwatch()
    throw error
  }

  tail.on('line', (data) => {
    core.info(data)
    if (data.includes('Initialization Sequence Completed')) {
      tail.unwatch()
      clearTimeout(timer)
      const pid = fs.readFileSync('openvpn.pid', 'utf8').trim()
      core.info(`VPN connected successfully. Daemon PID: ${pid}`)
      callback(pid)
    }
  })

  const timer = setTimeout(() => {
    core.setFailed('VPN connection failed.')
    tail.unwatch()
  }, 15000)
}

module.exports = run
