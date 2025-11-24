import {mediaBlock} from '../objects'
import {orderRankField, orderRankOrdering} from '@sanity/orderable-document-list'

export default {
  title: 'Project',
  name: 'project',
  type: 'document',
  orderings: [orderRankOrdering],
  fields: [
    orderRankField({type: 'project'}),
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
      title: 'Media',
      name: 'media',
      type: 'object',
      fields: [...mediaBlock],
    },
  ],
}
