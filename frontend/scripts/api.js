const sanityClient = require('@sanity/client');
const fs = require('fs');
const path = require('path');

// Optionally load environment variables from a .env file if present
try {
  // eslint-disable-next-line global-require
  require('dotenv').config();
} catch {
  // If dotenv isn't available or .env is missing, just continue
}

const projectId = "s6q1o64z";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || 'production';

let client = null;

if (!projectId || !dataset) {
  // Don't break the build if Sanity isn't configured – just skip fetching.
  // This keeps `npm run build` working in environments without Sanity env vars.
  // eslint-disable-next-line no-console
  console.warn(
    'Sanity configuration missing (projectId / dataset). Skipping siteSettings JSON generation in scripts/api.js.',
  );
} else {
  client = sanityClient.createClient({
    projectId,
    dataset,
    useCdn: false,
    apiVersion: '2023-10-24',
  });
}

const getSiteData = async () => {
  const query = `
        *[_type == "siteSettings"][0] {
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

  if (!client) {
    return [];
  }

  try {
    const data = await client.fetch(query);
    const dir = path.join(process.cwd(), 'json');
    const file = 'siteSettings.json';
    const jsonData = JSON.stringify(data);

    // Ensure the output directory exists
    fs.mkdirSync(dir, { recursive: true });

    fs.writeFile(path.join(dir, file), jsonData, 'utf8', () => {
      // eslint-disable-next-line no-console
      console.log(`Wrote ${file} file.`);
    });

    return data;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching site data:', error);
    return [];
  }
};

module.exports = {
  getSiteData,
};
