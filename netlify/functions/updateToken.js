const admin = require('firebase-admin');

exports.handler = async (event, context) => {
    // Check authorization
    if (event.headers.authorization !== `Bearer ${process.env.UPDATE_TOKEN_SECRET}`) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Unauthorized' })
        };
    }

    try {
        // Parse the Firebase credentials from environment variable
        const serviceAccount = {
            type: "service_account",
            project_id: "wse-tracker",
            private_key_id: "d6c7873e24252d04a838a6d3d8552c4a425d07fb",
            private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDyZsod6nrotimh\n3tFqSyFXJlaJIg0KfmUwS0OzeSkn8i5NN10DQx+LxQPfz/Qj1t/WH/zv2k+QI7Q3\nggBizxPGtnoQT7Dg2nYDwR/LFuponTr19HkmMAcf9ZkGhwe+WBg9MbIGukEZRngm\nrvZPh1SONctHa7TzBSQmmbpsjpH2Mo81ED0OYx/B7g9gXYYkN5tbDcwLgcr3PhjV\nMteL+vSedIYsoEE7jHIRmN9F1qsWynvt6j8oK1oC02O+FJj4GecOYMQskmIPDAeG\n0BXDm6aRupTkLpzWnHC9OfE1tECITeGmLcZHrsS47TYvLFCISn9ozIM7gFgGj61u\nsuNKl18/AgMBAAECggEARAN0XZ1/nBEUsF75KlZnRfEzYankt9eMI9dSaSarVhJ9\nTFwm5HXugYSnmCJcsbumNYnnKhN6tIpYFCUNX6wTs/NaX35EtmqFp3sGJTFKV00a\nkI1mesEKFr0OEUdM9Gr6bh0mAv46qtFbgBsicGEb6AUPAvylGnUMVipXJQOBz+6G\n7LF3mYvMo2zE64jEfK0636hLWly30OvQF3C6IzpYzdpIOn/vLoOiWCj3tbCfefUQ\nkfOMZaTXTSWE0yx8qm3aoy4/M7tlvVMd7NOGEKlOkBVhEGvFj6nbmpz0rEDbGyVO\nX0NvpE7KvSAHiA/egVJEgfQeMnztlpEM8sFW0L1pYQKBgQD+6EjA1MQGFXZ9RHku\nLaeyFapbrz/SL35fAr/zvD/0TsQubfL6bl8r2ZYmCR5+HOpiCMbcWbLXdgDRyKaz\nh/hbzuucPhY6wUCNrs1ph+ByesnytCqBmZ6jKJUfLo3tMojkzcJU+pfwVcg/YLCR\nhY+PpIcJGuIy+9Mke/PCb+du3wKBgQDzcMhJ5A2J9p9eQplIwujSXUhjiUleZKUr\ngq4B6vf1BmH4GwDsP4oiYU/mjN6HHH3B7/CZ/yGBvF/wXAAXOSy3GAv6lPBdndGq\n6zIAUzZKGfY4mAqmXbj6KJGI6jvdSuQPjiSVDHx6hgkXL/GmASrM2Q4IF8okr9/P\n/JQL6Gr7oQKBgQDxfg6u4ON1ABBpTN2hKg+dX3ktszG7ZtNKH8jKmKXeRmEFu5Re\nPQJdAJ6HGkyRHcPPbJE5YKFWDq1oEbgcjcx07eu48fkNYNhPYjOortmsmzeHf7hl\nX6wy1tev2uMKvL2ERoq9B0u6nQpBQNEGjIodg7mKnrV9p6W5AtVEd8/B8QKBgFgA\nXjbv3MERyRyfAKBf7SAWnpN0znPz+A1ZiSOiWA5YR1QUFupQMdQpz2Ntawf2kbNo\n1FYm92rZuOi/qTy762EorTPhYV7GLUQXD5U0f3ycE/jzZW4slTDBN5MB8bAWYYkJ\n/klvIRR9nY2nRDiZVWqF0F+2kdlfRo3+JVqEox/hAoGAH2zkeG6WEuSpE8CGJKZp\nD3SbXfHCIpUNKfz15cVDXv7DVdxo7F4LR0dEl7nBXAQ/D7KskxwV0zsGBo2Y0Q+Q\nn04azS/DxNWApUAoAhBte46bmdGVG7ETKqhexGhCoxN/Drq9LUG8Q/fxc/wvhiOr\nCT2xD5T1c1zT2RW0LwBKPSM=\n-----END PRIVATE KEY-----\n",
            client_email: "firebase-adminsdk-fbsvc@wse-tracker.iam.gserviceaccount.com",
            client_id: "114182141909691543774",
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token"
        };

        // Initialize Firebase
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }

        const db = admin.firestore();
        
        // Save test token for now
        await db.collection('config').doc('wseToken').set({
            token: "test-token-" + Date.now(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Token saved' })
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};