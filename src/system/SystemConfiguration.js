/**
 * @module System
 *
 * @requires lib/check
 * @requires api/Api
 */
import Api from 'd2/api/Api';

/**
 * @class SystemConfiguration
 *
 * @description
 * Handles communication with the configuration endpoint. Can be used to get or set configuration options.
 */
// TODO: Return the values from the local cache if we have not updated it? We could
class SystemConfiguration {
    constructor(api = Api.getApi()) {
        this.api = api;

        this._configuration = undefined;
    }

    /**
     * @method all
     *
     * @returns {Promise} Promise that resolves with all the individual configuration options from the api.
     *
     * @description
     * Fetches all system configuration settings from the API and caches them so that future calls to this function
     * won't call the API again.
     * ```js
     * d2.system.configuration.all()
     *  .then(configuration => {
     *    console.log(
     *      'Self-registered users will be assigned to the : ' +
     *      configuration.selfRegistrationOrgUnit + ' org unit'
     *    );
     *  });
     * ```
     *
     * @param {boolean} ignoreCache If set to true, calls the API regardless of cache status
     */
    all(ignoreCache) {
        if (this._configuration && ignoreCache !== true) {
            return Promise.resolve(this._configuration);
        }
        const that = this;

        return Promise.all([
            this.api.get(['configuration', 'systemId'].join('/')),
            this.api.get(['configuration', 'feedbackRecipients'].join('/')),
            this.api.get(['configuration', 'offlineOrganisationUnitLevel'].join('/')),
            this.api.get(['configuration', 'infrastructuralIndicators'].join('/')),
            this.api.get(['configuration', 'infrastructuralDataElements'].join('/')),
            this.api.get(['configuration', 'infrastructuralPeriodType'].join('/')),
            this.api.get(['configuration', 'selfRegistrationRole'].join('/')),
            this.api.get(['configuration', 'selfRegistrationOrgUnit'].join('/')),
            this.api.get(['configuration', 'remoteServerUrl'].join('/')),
            this.api.get(['configuration', 'remoteServerUsername'].join('/')),
            this.api.get(['configuration', 'corsWhitelist'].join('/')),
        ]).then(config => {
            that._configuration = {
                systemId: config[0],
                feedbackRecipients: config[1],
                offlineOrganisationUnitLevel: config[2],
                infrastructuralIndicators: config[3],
                infrastructuralDataElements: config[4],
                infrastructuralPeriodType: config[5],
                selfRegistrationRole: config[6],
                selfRegistrationOrgUnit: config[7],
                remoteServerUrl: config[8],
                remoteServerUsername: config[9],
                corsWhitelist: config[10],
            };
            return Promise.resolve(that._configuration);
        });
    }

    /**
     * Returns the value of the specified configuration option.
     *
     * This is a convenience method that works exactly the same as calling `configuration.all()[name]`.
     *
     * @param key
     * @param ignoreCache
     * @returns {*|Promise}
     */
    get(key, ignoreCache) {
        return this.all(ignoreCache).then(config => {
            if (config.hasOwnProperty(key)) {
                return Promise.resolve(config[key]);
            }

            return Promise.reject('Unknown config option: ' + key);
        });
    }


    /**
     * Send a query to the API to change the value of a configuration key to the specified value
     *
     * @param key
     * @param value
     * @returns {Promise}
     */
    set(key, value) {
        const that = this;
        let req;

        if (key === 'feedbackRecipients' && value === 'null' || value === null) {
            req = this.api.delete(['configuration', key].join('/'), {dataType: 'text'});
        } else if (key === 'corsWhitelist') {
            req = this.api.post(['configuration', key].join('/'), value.trim().split('\n'), {dataType: 'text'});
        } else {
            req = this.api.post(['configuration', key, value].join('/'), '', {dataType: 'text'});
        }

        return req.then(() => {
            // Ideally we'd update the cache here, but doing so requires another trip to the server
            // For now, just bust the cache to ensure it's not incorrect
            that._configuration = undefined;
            return Promise.resolve();
        });
    }
}

export default SystemConfiguration;
