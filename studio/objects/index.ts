const selectMediaTypeObject = {
  title: 'Select Media Type',
  name: 'mediaType',
  type: 'string',
  options: {
    list: [
      {title: 'Image', value: 'image'},
      {title: 'Video', value: 'video'},
    ],
    layout: 'dropdown',
  },
}

const seoObject = {
  title: 'SEO',
  name: 'seo',
  type: 'object',
  fields: [
    {
      name: 'title',
      type: 'string',
      title: 'SEO Title',
    },
    {
      name: 'description',
      type: 'text',
      title: 'Meta Description',
      rows: 3,
    },
  ],
}

const imageObject = {
  title: 'Image',
  name: 'image',
  type: 'image',
  fields: [
    {
      name: 'alt',
      type: 'string',
      title: 'Alt Text',
    },
  ],
  options: {
    collapsible: false,
    collapsed: false,
  },
}

const videoObject = {
  title: 'Video',
  name: 'video',
  type: 'mux.video',
  options: {
    collapsible: false,
    collapsed: false,
    showAudioControls: true,
  },
}

const mediaBlock = [
  {
    title: 'Media',
    name: 'media',
    type: 'object',
    fields: [
      selectMediaTypeObject,
      {
        ...imageObject,
        hidden: ({parent}: any) => parent?.mediaType !== 'image',
      },
      {
        ...videoObject,
        hidden: ({parent}: any) => parent?.mediaType !== 'video',
      },
      {
        ...imageObject,
        title: 'Thumbnail Image',
        name: 'thumbnailImage',
        hidden: ({parent}: any) => parent?.mediaType !== 'video',
      },
    ],
  },
]

export {mediaBlock, imageObject, videoObject, selectMediaTypeObject, seoObject}
