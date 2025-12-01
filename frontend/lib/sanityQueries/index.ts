export const mediaString = `
	"media": {
		"mediaType": coalesce(media.mediaType, media.media.mediaType),
		"image": coalesce(
			media.image{
				asset-> {
					url,
					metadata {
						lqip,
						dimensions {
							aspectRatio,
							width,
							height,
						},
					}
				},
				alt
			},
			media.media.image{
				asset-> {
					url,
					metadata {
						lqip,
						dimensions {
							aspectRatio,
							width,
							height,
						},
					}
				},
				alt
			}
		),
		"thumbnailImage": coalesce(
			media.thumbnailImage{
				asset-> {
					url,
					metadata {
						lqip,
						dimensions {
							aspectRatio,
							width,
							height,
						},
					}
				},
				alt
			},
			media.media.thumbnailImage{
				asset-> {
					url,
					metadata {
						lqip,
						dimensions {
							aspectRatio,
							width,
							height,
						},
					}
				},
				alt
			}
		),
		"video": coalesce(
			media.video{
				asset-> {
					playbackId,
				},
			},
			media.media.video{
				asset-> {
					playbackId,
				},
			}
		)
	}
`;

export const siteSettingsQueryString = `
	*[_type == 'siteSettings'][0] {
		referenceTitle,
		seoTitle,
		seoDescription,
		biography,
		phone,
		email,
		instagramHandle,
		instagramLink,
	}
`;

export const homePageQueryString = `
	*[_type == 'homePage'][0] {
		...,
	}
`;

export const workPageQueryString = `
	*[_type == "workPage"] {
		...,
		seoTitle,
		seoDescription,
	}
`;

export const projectsQueryString = `
	*[_type == 'project'] [0...100] {
		_id,
		title,
		type,
		slug,
		${mediaString}
	}
`;
