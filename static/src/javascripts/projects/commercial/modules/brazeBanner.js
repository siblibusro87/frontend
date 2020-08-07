// @flow

import type { Banner } from 'common/modules/ui/bannerPicker';
import config from 'lib/config';
import { oldCmp } from '@guardian/consent-management-platform';
import { mountDynamic } from "@guardian/automat-modules";

import { getUserFromApi } from '../../common/modules/identity/api';
import { isDigitalSubscriber } from "../../common/modules/commercial/user-features";

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

// TODO: update this for TDFv2 and CCPA
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

            if (!isDigitalSubscriber()) {
                resolve(false);
                return;
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

    return import(
                /* webpackChunkName: "guardian-braze-components" */ '@guardian/braze-components'
            )
                .then((module) => {
                    console.log('Loaded web components', module);

                    const container = document.createElement('div');
                    container.classList.add('braze-banner-container');

                    if (document.body) {
                        document.body.appendChild(container);
                    }

                    mountDynamic(
                        container,
                        module.ExampleComponent,
                        { message: messageConfig.extras["test-key"] },
                        true,
                        );
                })
                .catch((error) =>
                    console.log(
                        'Something went wrong with braze web components',
                        error,
                    ),
                );
};

export const brazeBanner: Banner = {
    id: 'brazeBanner',
    show,
    canShow,
};
