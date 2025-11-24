import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 's6q1o64z',
    dataset: 'production'
  },
  // Note: `deployment` options are only supported in newer Sanity CLI versions.
  // Remove or adjust this block if using an older CLI to avoid type errors.
})
