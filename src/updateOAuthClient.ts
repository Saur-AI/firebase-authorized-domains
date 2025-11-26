import {
  CredentialBody,
  ExternalAccountClientOptions,
  GoogleAuth
} from 'google-auth-library'
import * as core from '@actions/core'
import fetch from 'node-fetch'

export type Action = 'add' | 'remove'

/**
 * Updates the authorized JavaScript origins for an OAuth 2.0 client
 * Note: Google Cloud Platform does not provide a fully public API for managing
 * OAuth client authorized origins. This implementation uses Google's internal
 * API endpoints that power the Cloud Console UI.
 *
 * @param action - 'add' or 'remove'
 * @param domain - The domain to add or remove (e.g., 'example.com')
 * @param oauthClientId - The OAuth 2.0 Client ID
 * @param credentials - The service account credentials
 */
export const updateOAuthClientOrigins = async (
  action: Action,
  domain: string,
  oauthClientId: string,
  credentials: CredentialBody | ExternalAccountClientOptions
): Promise<void> => {
  // Acquire an auth client
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  })

  const authClient = await auth.getClient()
  const projectId = await auth.getProjectId()

  // Construct the full domain URL (https://domain)
  // Check if domain already has a protocol to avoid creating malformed URLs
  const domainUrl = domain.startsWith('https://')
    ? domain
    : domain.startsWith('http://')
    ? domain.replace('http://', 'https://')
    : `https://${domain}`

  core.debug(`Project ID: ${projectId}`)
  core.debug(`OAuth Client ID: ${oauthClientId}`)
  core.debug(`Domain URL: ${domainUrl}`)

  // Get access token
  const accessTokenResponse = await authClient.getAccessToken()
  if (!accessTokenResponse.token) {
    throw new Error('Failed to get access token')
  }
  const accessToken = accessTokenResponse.token

  // Use Google Cloud Platform's internal API endpoint for OAuth client management
  // Note: These endpoints (:getOAuthClient and :updateOAuthClient) are not officially
  // documented in the Cloud Resource Manager API documentation. They are internal
  // endpoints used by the Google Cloud Console UI. While functional, they may change
  // without notice. If these endpoints become unavailable, the action will gracefully
  // fall back with a warning message directing users to manually update OAuth clients.
  const baseUrl = 'https://cloudresourcemanager.googleapis.com/v1'
  const clientUrl = `${baseUrl}/projects/${projectId}:getOAuthClient`

  try {
    core.debug(`Fetching OAuth client configuration for ${oauthClientId}...`)

    // Get the current OAuth client configuration
    const getResponse = await fetch(clientUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: oauthClientId
      })
    })

    if (!getResponse.ok) {
      const errorText = await getResponse.text()
      core.warning(
        `Could not fetch OAuth client configuration via API: ${getResponse.status} - ${errorText}`
      )
      core.warning(
        `Please manually update the authorized JavaScript origins for OAuth client ${oauthClientId} in the Google Cloud Console at https://console.cloud.google.com/apis/credentials?project=${projectId}`
      )
      return
    }

    const clientConfig = (await getResponse.json()) as {
      javascript_origins?: string[]
      redirect_uris?: string[]
    }
    core.debug('Current OAuth client config:')
    core.debug(JSON.stringify(clientConfig, null, 2))

    const currentOrigins: string[] = clientConfig.javascript_origins || []

    // Update authorized JavaScript origins based on action
    let updatedOrigins: string[]

    if (action === 'add') {
      core.debug(`Adding ${domainUrl} to OAuth client ${oauthClientId}`)
      core.info(`Adding ${domainUrl} to OAuth client ${oauthClientId}`)

      if (currentOrigins.includes(domainUrl)) {
        core.info(
          `Domain ${domainUrl} already exists in OAuth client ${oauthClientId}`
        )
        return
      }

      updatedOrigins = [...currentOrigins, domainUrl]
    } else {
      // action === 'remove'
      core.debug(`Removing ${domainUrl} from OAuth client ${oauthClientId}`)
      core.info(`Removing ${domainUrl} from OAuth client ${oauthClientId}`)

      if (!currentOrigins.includes(domainUrl)) {
        core.info(
          `Domain ${domainUrl} does not exist in OAuth client ${oauthClientId}`
        )
        return
      }

      updatedOrigins = currentOrigins.filter(origin => origin !== domainUrl)
    }

    // Update the OAuth client with new origins
    const updateUrl = `${baseUrl}/projects/${projectId}:updateOAuthClient`
    const updateResponse = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: oauthClientId,
        javascript_origins: updatedOrigins,
        redirect_uris: clientConfig.redirect_uris || []
      })
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      core.warning(
        `Could not update OAuth client via API: ${updateResponse.status} - ${errorText}`
      )
      core.warning(
        `Please manually update the authorized JavaScript origins for OAuth client ${oauthClientId} in the Google Cloud Console at https://console.cloud.google.com/apis/credentials?project=${projectId}`
      )
      return
    }

    const updateResult = await updateResponse.json()
    core.debug('Update result:')
    core.debug(JSON.stringify(updateResult, null, 2))

    if (action === 'add') {
      core.info(
        `Successfully added ${domainUrl} to OAuth client ${oauthClientId}`
      )
    } else {
      core.info(
        `Successfully removed ${domainUrl} from OAuth client ${oauthClientId}`
      )
    }
  } catch (error) {
    if (error instanceof Error) {
      core.error(`Failed to update OAuth client origins: ${error.message}`)
      core.warning(
        `OAuth client origin update failed. Please manually update the authorized JavaScript origins for OAuth client ${oauthClientId} in the Google Cloud Console at https://console.cloud.google.com/apis/credentials?project=${projectId}`
      )
    }
    throw error
  }
}
