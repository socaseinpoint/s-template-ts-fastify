import { closeTestServer } from '../helpers/test-server'

/**
 * Global teardown function
 * Runs after all tests complete
 */
export default async function teardown() {
  console.log('🧹 Running global teardown...')

  // Close test server if still running
  await closeTestServer()

  // Add any other cleanup here
  // e.g., close database connections, clean up test files, etc.

  console.log('✨ Teardown complete')
}
