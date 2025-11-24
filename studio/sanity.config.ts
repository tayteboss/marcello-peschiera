import {defineConfig} from 'sanity'
import {deskTool} from 'sanity/desk'
import {schemaTypes} from './schemas'
import {muxInput} from 'sanity-plugin-mux-input'
import {vercelDeployTool} from 'sanity-plugin-vercel-deploy'
import {EarthGlobeIcon, CaseIcon} from '@sanity/icons'

export default defineConfig({
  name: 'default',
  title: 'Marcello Peschiera',

  projectId: 's6q1o64z',
  dataset: 'production',

  plugins: [
    deskTool({
      structure: (S, context) => {
        return S.list()
          .title('Content')
          .items([
            S.divider(),
            S.listItem()
              .title('Site Settings')
              .icon(EarthGlobeIcon)
              .child(S.editor().schemaType('siteSettings').documentId('siteSettings')),
            S.divider(),
            S.listItem()
              .title('Project')
              .icon(CaseIcon)
              .child(
                S.documentList()
                  .title('Project')
                  .schemaType('project')
                  .filter('_type == "project"'),
              ),
          ])
      },
    }),
    muxInput({mp4_support: 'standard', max_resolution_tier: '2160p'}),
    vercelDeployTool(),
  ] as any,

  schema: {
    types: schemaTypes,
  },

  parts: [
    {
      name: 'part:@sanity/base/theme/variables-style',
      path: './customEditorStyles.css',
    },
  ],
})
