
import { useState, useCallback, useEffect } from 'react';
import { GOOGLE_DRIVE_CONFIG } from '@/constants';

declare global {
    interface Window {
        google: any;
        gapi: any;
    }
}

export const useGoogleDrivePicker = () => {
    const [token, setToken] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const loadScripts = () => {
            const gapiScript = document.createElement('script');
            gapiScript.src = 'https://apis.google.com/js/api.js';
            gapiScript.async = true;
            gapiScript.onload = () => {
                window.gapi.load('client', () => {
                    setIsLoaded(true);
                });
            };
            document.body.appendChild(gapiScript);

            const gsiScript = document.createElement('script');
            gsiScript.src = 'https://accounts.google.com/gsi/client';
            gsiScript.async = true;
            document.body.appendChild(gsiScript);
        };
        loadScripts();
    }, []);

    const authenticate = useCallback(() => {
        return new Promise<string>((resolve, reject) => {
            try {
                const client = window.google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_DRIVE_CONFIG.CLIENT_ID,
                    scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
                    callback: (response: any) => {
                        if (response.error) {
                            console.error('Auth error:', response);
                            reject(response);
                        }
                        setToken(response.access_token);
                        resolve(response.access_token);
                    },
                });
                client.requestAccessToken();
            } catch (err) {
                console.error('Failed to init TokenClient:', err);
                reject(err);
            }
        });
    }, []);

    const openPicker = useCallback(async (onFileSelected: (file: any) => void) => {
        try {
            const accessToken = token || await authenticate();
            
            const createPicker = () => {
                const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_IMAGES)
                    .setIncludeFolders(true)
                    .setSelectableMimeTypes('image/png,image/jpeg,image/jpg');

                const picker = new window.google.picker.PickerBuilder()
                    .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
                    .setAppId(GOOGLE_DRIVE_CONFIG.APP_ID)
                    .setOAuthToken(accessToken)
                    .addView(view)
                    .setDeveloperKey(GOOGLE_DRIVE_CONFIG.API_KEY)
                    .setCallback((data: any) => {
                        if (data.action === window.google.picker.Action.PICKED) {
                            const file = data.docs[0];
                            onFileSelected({
                                id: file.id,
                                name: file.name,
                                mimeType: file.mimeType,
                                url: file.url,
                                downloadUrl: `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
                                accessToken
                            });
                        }
                    })
                    .build();
                picker.setVisible(true);
            };

            window.gapi.load('picker', { callback: createPicker });
        } catch (err) {
            console.error('Error opening picker:', err);
        }
    }, [token, authenticate]);

    return { openPicker, isLoaded };
};
