import {mediaBlock} from '../objects'

export default {
  title: 'Project',
  name: 'project',
  type: 'document',
  fields: [
    {
      title: 'Title',
      name: 'title',
      type: 'string',
      validation: (Rule: any) => Rule.required(),
    },
    {
      title: 'Type',
      name: 'type',
      type: 'string',
      options: {
        list: [
          {title: 'Photography', value: 'photography'},
          {title: 'Cinematography', value: 'cinematography'},
          {title: 'Direction', value: 'direction'},
        ],
        layout: 'dropdown',
      },
    },
    {
      title: 'Slug',
      name: 'slug',
      type: 'slug',
      options: {
        source: 'title',
      },
    },
    ...mediaBlock,
  ],
}
