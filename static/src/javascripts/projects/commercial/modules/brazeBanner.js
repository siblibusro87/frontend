// @flow

import type { Banner } from 'common/modules/ui/bannerPicker';
import config from 'lib/config';
import { oldCmp } from '@guardian/consent-management-platform';
import { getUserFromApi } from '../../common/modules/identity/api';

const brazeSwitch = config.get('switches.brazeSwitch');
const apiKey = config.get('page.brazeApiKey');

const getBrazeUuid = (): Promise<string> =>
    new Promise((resolve, reject) => {
        getUserFromApi(user => {
            if (user && user.privateFields && user.privateFields.brazeUuid){
                resolve(user.privateFields.brazeUuid);
            } else {
                reject();
            }
        })
    });

const hasRequiredConsents = (): Promise<void> =>
    new Promise((resolve, reject) => {
        oldCmp.onIabConsentNotification(state => {
            if (state[1] && state[2] && state[3] && state[4] && state[5]) {
                resolve();
            } else {
                reject();
            }
        })
    });

let messageConfig;
let canShowPromise;

const canShow = () => {
    if (canShowPromise) {
        return canShowPromise;
    }

    canShowPromise = new Promise(async resolve => {
        console.log("can we show a braze banner?")
        try {
            if (!(brazeSwitch && apiKey)) {
                throw new Error("Braze not enabled or API key not available");
            }

            const [brazeUuid] = await Promise.all([getBrazeUuid(), hasRequiredConsents()]);
            const appboy = await import(/* webpackChunkName: "braze-web-sdk-core" */ '@braze/web-sdk-core');

            appboy.initialize(apiKey, {
                enableLogging: false,
                noCookies: true,
                baseUrl: 'https://sdk.fra-01.braze.eu/api/v3',
                enableHtmlInAppMessages: true,
                sessionTimeoutInSeconds: 1,
            });

            appboy.subscribeToInAppMessage(configuration => {
                console.log("Can show braze banner", configuration);
                messageConfig = configuration;
                resolve(true);
            });

            appboy.changeUser(brazeUuid);
            appboy.openSession();
        } catch(e) {
            resolve(false);
        }
    });

    return canShowPromise;
}

canShow();

const show = () => {
    console.log("Showing the braze banner", messageConfig);
    return Promise.resolve(true);
};

export const brazeBanner: Banner = {
    id: 'brazeBanner',
    show,
    canShow,
};
