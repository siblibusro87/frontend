// @flow

import type { Banner } from 'common/modules/ui/bannerPicker';
import config from 'lib/config';
import { oldCmp } from '@guardian/consent-management-platform';
import { getUserFromApi } from '../../common/modules/identity/api';

const brazeSwitch = config.get('switches.brazeSwitch');
const apiKey = config.get('page.brazeApiKey');

const getBrazeUuid = (): Promise<string> =>
    new Promise(resolve => {
        getUserFromApi(user => {
            if (user && user.privateFields && user.privateFields.brazeUuid){
                resolve(user.privateFields.brazeUuid);
            }
        })
    });

const hasRequiredConsents = (): Promise<void> =>
    new Promise(resolve => {
        oldCmp.onIabConsentNotification(state => {
            if (state[1] && state[2] && state[3] && state[4] && state[5]) {
                resolve();
            }
        })
    });

type InitBrazeResult = {
    appboy: any,
    brazeUuid: string,
};

const initBraze = async (): Promise<InitBrazeResult> => {
    if (!(brazeSwitch && apiKey)) {
        throw new Error("Braze not enabled or API key not available");
    }

    const [brazeUuid] = await Promise.all([getBrazeUuid(), hasRequiredConsents()]);
    const appboy = await import(/* webpackChunkName: "braze-web-sdk" */ '@braze/web-sdk');

    console.log("INITIALIZING BRAZE")
    appboy.initialize(apiKey, {
        enableLogging: true,
        noCookies: true,
        baseUrl: 'https://sdk.fra-01.braze.eu/api/v3',
        enableHtmlInAppMessages: true,
        sessionTimeoutInSeconds: 1,
    });

    return {
        appboy,
        brazeUuid,
    }
}

console.log("calling init braze")
const brazeInitResult = initBraze();

let messageConfig;

const canShow = () => new Promise(async resolve => {
    console.log("can we show a braze banner?")
    try {
        const {appboy, brazeUuid} = await brazeInitResult;
        console.log("one step forwards")

        appboy.changeUser(brazeUuid);

        appboy.subscribeToInAppMessage(configuration => {
            console.log("Can show braze banner", configuration);
            messageConfig = configuration;
            resolve(true);
        });

        appboy.openSession();
    } catch(e) {
        resolve(false);
    }
});

const show = () => {
    console.log("Showing the braze banner", messageConfig);
    return Promise.resolve(true);
};

export const brazeBanner: Banner = {
    id: 'brazeBanner',
    show,
    canShow,
};
