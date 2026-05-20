import config from '../config.json';

const configData = config as any;

interface SanityRegistrationPayload {
  title: string;
  firstName: string;
  lastName: string;
  email: string;
}

export async function logRegistrationToSanity(account: SanityRegistrationPayload) {
  const { projectId, dataset, token } = configData.sanity;
  
  // Sanity HTTP API Mutations Endpoint URL
  const url = `https://${projectId}.api.sanity.io/v2026-05-20/data/mutate/${dataset}`;

  // Formatting the document matching Sanity's requirements
  const mutations = {
    mutations: [
      {
        create: {
          _type: 'userRegistration', // Make sure this matches your schema name in Sanity
          title: account.title,
          firstName: account.firstName,
          lastName: account.lastName,
          email: account.email,
          registeredAt: new Date().toISOString()
        }
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(mutations)
    });

    // ✅ Replace it with this explicitly typed block:
    const result = await response.json() as { message?: string; [key: string]: any };

    if (!response.ok) {
    console.error('❌ Sanity HTTP API Error:', result);
    throw new Error(result.message || 'Failed to push to Sanity');
    }

    console.log('🚀 Successfully synced registration to Sanity.io Studio!');
    return result;
  } catch (error) {
    console.error('❌ Network/Sanity Error:', error);
    throw error;
  }
}