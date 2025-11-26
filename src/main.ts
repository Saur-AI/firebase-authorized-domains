import * as core from '@actions/core'
import {Action, updateAuthorizedDomain} from './updateDomains'
import {updateOAuthClientOrigins} from './updateOAuthClient'
import {isUrl} from './utils'

async function run(): Promise<void> {
  try {
    const svc_account_key_json: string = core.getInput(
      'service_account_key_json'
    )
    const action = core.getInput('action')
    const domain = core.getInput('domain')
    const oauthClientId = core.getInput('oauth_client_id')
    let finalDomain = domain

    // try parsing url to check if it is valid
    if (!domain) throw new Error('Domain is required')

    if (isUrl(domain)) {
      core.debug('Domain is a url, extracting hostname')
      const url = new URL(domain)
      finalDomain = url.hostname
    }

    core.debug('Running action for updating firebase authorized domains')
    await updateAuthorizedDomain(
      action as Action,
      finalDomain,
      JSON.parse(svc_account_key_json)
    )
    core.debug('Firebase authorized domains updated successfully')

    // If OAuth client ID is provided, also update OAuth client origins
    if (oauthClientId) {
      core.debug(
        'OAuth client ID provided, updating OAuth client authorized origins'
      )
      await updateOAuthClientOrigins(
        action as Action,
        finalDomain,
        oauthClientId,
        JSON.parse(svc_account_key_json)
      )
      core.debug('OAuth client authorized origins updated successfully')
    }

    core.debug('Action completed successfully')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
