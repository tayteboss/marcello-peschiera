export default {
  title: 'Site Settings',
  name: 'siteSettings',
  type: 'document',
  fields: [
    {
      title: 'Reference Title',
      name: 'referenceTitle',
      type: 'string',
      description: 'This is an internal reference title.',
    },
    {
      title: 'SEO Title',
      name: 'seoTitle',
      type: 'string',
      description: 'SEO title for the site.',
    },
    {
      title: 'SEO Description',
      name: 'seoDescription',
      type: 'text',
      description: 'SEO description for the site.',
    },
    {
      title: 'Biography',
      name: 'biography',
      type: 'text',
      description: 'Short biography or description.',
    },
    {
      title: 'Phone',
      name: 'phone',
      type: 'string',
      description: 'Contact phone number.',
    },
    {
      title: 'Email',
      name: 'email',
      type: 'string',
      description: 'Contact email address.',
    },
    {
      title: 'Instagram Handle',
      name: 'instagramHandle',
      type: 'string',
      description: 'Instagram username (without @).',
    },
    {
      title: 'Instagram Link',
      name: 'instagramLink',
      type: 'url',
      description: 'Full Instagram profile URL.',
    },
  ],
}
