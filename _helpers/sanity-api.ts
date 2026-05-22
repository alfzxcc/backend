interface SanityRegistrationPayload {
  title: string;
  firstName: string;
  lastName: string;
  email: string;
}

export async function logRegistrationToSanity(account: SanityRegistrationPayload) {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET || 'production';
  const token = process.env.SANITY_TOKEN;

  const url = `https://${projectId}.api.sanity.io/v2026-05-20/data/mutate/${dataset}`;

  const mutations = {
    mutations: [
      {
        create: {
          _type: 'userRegistration',
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

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(JSON.stringify(errorData));
    }
    console.log('🚀 Successfully synced to Sanity.io!');
  } catch (error) {
    console.error('❌ Sanity sync error:', error);
  }
}
