// Import for global beforeEach / afterEach
import '../setup/setup.js';

import fixtures from '../fixtures/fixtures';

function resetCachedResponse(d2) {
    delete d2.getUserLocale.cachedResponse;
}

// TODO: The Config class should probably be mocked
describe('D2', () => {
    const proxyquire = require('proxyquire');
    let apiMock;
    let i18nStub;
    let I18n;
    const loggerMock = {
        error: sinon.spy(),
    };
    const loggerMockObject = {
        getLogger: () => {
            return loggerMock;
        },
    };

    // TODO: Make this mock a bit more dynamic so we can test for different ModelDefinition
    // jscs:disable
    const ModelDefinition = function ModelDefinition() {
        this.name = 'dataElement';
    };
    ModelDefinition.prototype = {
    };
    // jscs:enable
    const ModelDefinitionMock = {
        createFromSchema: sinon.stub().returns(new ModelDefinition()),
        prototype: {},
    };
    let d2;

    beforeEach(() => {
        ModelDefinitionMock.createFromSchema.callCount = 0;
        let apiMockClass;
        const schemasResponse = {
            schemas: [
                fixtures.get('/api/schemas/dataElement'),
                fixtures.get('/api/schemas/dataElement'),
                fixtures.get('/api/schemas/dataElement'),
            ],
        };

        apiMock = {
            get: stub(),
            setBaseUrl: spy(),
        };

        apiMock.get
            // First init round
            .onCall(0).returns(Promise.resolve(schemasResponse))
            .onCall(1).returns(new Promise(resolve => resolve(fixtures.get('/api/attributes'))))
            .onCall(2).returns(Promise.resolve({}))
            .onCall(3).returns(Promise.resolve([]))
            .onCall(4).returns(Promise.resolve('en'))
            .onCall(5).returns(Promise.resolve({ version: '2.21' }))
            .onCall(6).returns(Promise.resolve({ apps: [] }))

            // Second init round
            .onCall(7).returns(new Promise(resolve => resolve(schemasResponse)))
            .onCall(8).returns(new Promise(resolve => resolve(fixtures.get('/api/attributes'))))
            .onCall(9).returns(Promise.resolve({}))
            .onCall(10).returns(Promise.resolve([]))
            .onCall(11).returns(Promise.resolve('en'))
            .onCall(12).returns(Promise.resolve({ version: '2.21' }))
            .onCall(13).returns(Promise.resolve({ apps: [] }));


        function apiMocker() {
            return apiMock;
        }
        apiMockClass = apiMocker;

        apiMockClass.getApi = () => apiMock;

        // jscs:disable
        const ModelDefinitionsMock = function ModelDefinitions() {
            this.modelsMockList = true;
            this.add = function add(schema) {
                this[schema.name] = schema;
            };
        };
        // jscs:enable
        ModelDefinitionsMock.prototype = {
            add(schema) {
                this[schema.name] = schema;
            },
        };
        ModelDefinitionsMock.getModelDefinitions = sinon.stub().returns(new ModelDefinitionsMock());

        const jQueryMock = {
            ajax: stub(),
        };

        proxyquire('../../src/d2', {
            './model/models': {
                ModelDefinitions: ModelDefinitionsMock,
                ModelDefinition: ModelDefinitionMock,
            },
            './api/Api': apiMockClass,
            './external/jquery': jQueryMock,
            './logger/Logger': loggerMockObject,
        });

        proxyquire('../../src/i18n/I18n', {
            './api/Api': apiMockClass,
        });

        I18n = require('../../src/i18n/I18n');
        i18nStub = {
            addSource: spy(),
            addStrings: spy(),
            load: stub().returns(Promise.resolve()),
        };
        stub(I18n, 'getI18n').returns(i18nStub);

        d2 = require('../../src/d2');
        resetCachedResponse(d2);
    });

    afterEach(() => {
        I18n.getI18n.restore();
    });

    it('should have an init function', () => {
        expect(d2.init).to.be.a('function');
    });

    it('should have a getInstance function', () => {
        expect(d2.getInstance).to.be.a('function');
    });

    describe('init', () => {
        it('should call load on i18n instance', (done) => {
            d2.init();
            d2.getInstance()
                .then(() => {
                    expect(i18nStub.load).to.be.calledOnce;
                    done();
                })
                .catch(done);
        });
    });

    describe('config', () => {
        it('should have a default baseUrl in the config', () => {
            expect(d2.config.baseUrl).to.equal('/api');
        });

        it('should use the baseUrl from the pre-init config', (done) => {
            d2.config.baseUrl = '/dhis/api';

            d2.init();
            d2.getInstance()
                .then(() => {
                    expect(apiMock.setBaseUrl).to.be.calledWith('/dhis/api');
                    done();
                })
                .catch(done);
        });

        it('should let the init() config override the pre-init config', (done) => {
            d2.config.baseUrl = '/dhis/api';

            d2.init({ baseUrl: '/demo/api' });
            d2.getInstance()
                .then(() => {
                    expect(apiMock.setBaseUrl).to.be.calledWith('/demo/api');
                    done();
                })
                .catch(done);
        });

        it('should pass the sources Set as an sources array to the i18n class', (done) => {
            d2.config.i18n.sources.add('global.properties');
            d2.config.i18n.sources.add('nonglobal.properties');
            d2.config.i18n.sources.add('systemsettings.properties');

            d2.init();
            d2.getInstance()
                .then(() => {
                    expect(i18nStub.addSource).to.have.callCount(3);
                    done();
                })
                .catch((e) => {
                    done(e);
                });
        });

        it('should call addStrings for the pre-init added strings', (done) => {
            d2.config.i18n.strings.add('name');
            d2.config.i18n.strings.add('yes');

            d2.init();
            d2.getInstance()
                .then(() => {
                    expect(i18nStub.addStrings).to.be.calledWith(['name', 'yes']);
                    done();
                })
                .catch((e) => {
                    done(e);
                });
        });
    });

    describe('getInstance', () => {
        it('should return a promise', () => {
            expect(d2.getInstance()).to.be.instanceof(Promise);
        });

        it('should return the d2 instance after init', (done) => {
            Promise.all([d2.init({ baseUrl: '/dhis/api' }), d2.getInstance()])
                .then(([d2FromInit, d2FromFactory]) => {
                    expect(d2FromInit).to.equal(d2FromFactory);
                    done();
                })
                .catch(done);
        });

        it('should return the same instance on getInstance calls', (done) => {
            d2.init({ baseUrl: '/dhis/api' });

            Promise.all([d2.getInstance(), d2.getInstance()])
                .then(([firstCallResult, secondCallResult]) => {
                    expect(firstCallResult).to.equal(secondCallResult);
                    done();
                })
                .catch(done);
        });

        it('should return a different instance after re-init', (done) => {
            d2.init();
            const instanceAfterFirstInit = d2.getInstance();

            instanceAfterFirstInit.then((first) => {
                resetCachedResponse(d2);

                d2.init({ baseUrl: '/dhis/api' });
                const instanceAfterSecondInit = d2.getInstance();

                return Promise.all([first, instanceAfterSecondInit]);
            })
            .then(([first, second]) => {
                expect(first).not.to.equal(second);
                done();
            })
            .catch(done);
        });

        it('should return a promise when calling getInstance before init', () => {
            expect(d2.getInstance()).to.be.instanceof(Promise);
        });
    });

    it('should set the base url onto the api', () => {
        d2.init({ baseUrl: '/dhis/api' });

        expect(apiMock.setBaseUrl).to.have.been.calledWith('/dhis/api');
    });

    it('should set the baseUrl to the default /api', () => {
        d2.init({});

        expect(apiMock.setBaseUrl).to.have.been.called;
    });

    it('should throw an error when the passed config is not an object', () => {
        function shouldThrowOnString() {
            d2.init(' ');
        }

        function shouldThrowOnFunction() {
            d2.init(() => {return true;});
        }

        expect(shouldThrowOnString).to.throw('Expected Config parameter to have type object');
        expect(shouldThrowOnFunction).to.throw('Expected Config parameter to have type object');
    });

    it('should not throw an error when no config is passed', () => {
        function shouldNotThrow() {
            d2.init();
        }

        expect(shouldNotThrow).to.not.throw();
    });

    it('should call the api', (done) => {
        d2.init({ baseUrl: '/dhis/api' })
            .then(() => {
                expect(apiMock.get).to.have.been.calledWith('schemas');
                done();
            })
            .catch(done);
    });

    it('should log the error when schemas can not be requested', (done) => {
        apiMock.get.onFirstCall().returns(Promise.reject(new Error('Failed')));

        d2.init({ baseUrl: '/dhis/api' })
            .then(
                () => {
                    done('No error occurred');
                },
                () => {
                    expect(loggerMock.error.callCount).to.equal(1);
                    expect(loggerMock.error.withArgs('Unable to get schemas from the api').callCount).to.equal(1);
                    done();
                }
            )
            .catch(done);
    });

    it('should return an object with the api object', (done) => {
        d2.init({ baseUrl: '/dhis/api' })
            .then(newD2 => {
                expect(newD2.Api.getApi()).to.equal(apiMock);
                done();
            })
            .catch(done);
    });

    it('should call the api for all startup calls', (done) => {
        d2.init({ baseUrl: '/dhis/api' })
            .then(() => {
                expect(apiMock.get).to.be.callCount(7);
                done();
            })
            .catch(done);
    });

    it('should query the api for all the attributes', (done) => {
        d2.init({ baseUrl: '/dhis/api' })
            .then(() => {
                const attributeCall = apiMock.get.getCall(1);
                /* 0: Url, 1: Data, 1: Query params, 2: Request options */
                expect(attributeCall.args[0]).to.equal('attributes');
                expect(attributeCall.args[1]).to.deep.equal({ fields: ':all,optionSet[:all,options[:all]]', paging: false });
                done();
            })
            .catch(done);
    });

    describe('creation of ModelDefinitions', () => {
        it('should add the model definitions object to the d2 object', (done) => {
            d2.init()
                .then(newD2 => {
                    expect(newD2.models).to.not.be.undefined;
                    expect(newD2.models.modelsMockList).to.equal(true);
                    done();
                })
                .catch(done);
        });

        // FIXME: Test fails because the the ModelDefinitions class is a singleton
        xit('should create a ModelDefinition for each of the schemas', (done) => {
            d2.init()
                .then(() => {
                    expect(ModelDefinitionMock.createFromSchema).to.have.been.called;
                    expect(ModelDefinitionMock.createFromSchema.callCount).to.equal(3);
                    done();
                })
                .catch(done);
        });

        it('should call the ModelDefinition.createFromSchema with the schema', (done) => {
            d2.init()
                .then(() => {
                    expect(ModelDefinitionMock.createFromSchema).to.have.been.calledWith(fixtures.get('/api/schemas/dataElement'), fixtures.get('dataElementAttributes'));
                    done();
                })
                .catch(done);
        });

        it('should add the ModelDefinitions to the models list', (done) => {
            d2.init()
                .then(newD2 => {
                    expect(newD2.models.dataElement).to.not.be.undefined;
                    done();
                })
                .catch(done);
        });
    });

    describe('currentUser', () => {
        it('should be available on the d2 object', (done) => {
            d2.init();
            d2.getInstance()
                .then(newD2 => {
                    expect(newD2.currentUser).to.not.be.undefined;
                    done();
                })
                .catch(done);
        });
    });

    describe('getUserSettings', () => {
        beforeEach(() => {
            resetCachedResponse(d2);
        });

        it('should be a function', () => {
            expect(d2.getUserSettings).to.be.a('function');
        });

        it('should return an object with the uiLocale', (done) => {
            apiMock.get.onFirstCall().returns(Promise.resolve('fr'));

            d2.getUserSettings()
                .then(settings => {
                    expect(settings.uiLocale).to.equal('fr');
                    done();
                })
                .catch(done);
        });

        it('should call the api for keyUiLocale', () => {
            d2.getUserSettings();

            expect(apiMock.get).to.be.called;
        });

        it('should set the default locale if the call fails', (done) => {
            apiMock.get.onFirstCall().returns(Promise.reject({ message: 'Not found' }));

            d2.getUserSettings()
                .then(settings => {
                    expect(settings.uiLocale).to.equal('en');
                    done();
                })
                .catch(done);
        });

        it('should preset the baseUrl from the config', (done) => {
            d2.config.baseUrl = '/dhis/api';

            d2.getUserSettings()
                .then(() => {
                    expect(apiMock.setBaseUrl).to.be.calledWith('/dhis/api');
                    done();
                })
                .catch(done);
        });

        it('should use the default base url when the set baseUrl is not valid', (done) => {
            d2.config.baseUrl = undefined;

            d2.getUserSettings()
                .then(() => {
                    expect(apiMock.setBaseUrl).not.to.be.called;
                    expect(apiMock.get).to.be.calledWith('userSettings/keyUiLocale');
                    done();
                })
                .catch(done);
        });
    });

    describe('getUserLocale', () => {
        beforeEach(() => resetCachedResponse(d2));

        it('should get the userlocale from the server', (done) => {
            d2.getUserLocale()
                .then(() => {
                    expect(apiMock.get).to.be.calledWith('userSettings/keyUiLocale');
                    done();
                })
                .catch(done);
        });

        it('should just request the locale once from the server when called multiple times', () => {
            return Promise.all([d2.getUserLocale(), d2.getUserLocale()])
                .then(() => {
                    expect(apiMock.get).to.be.calledWith('userSettings/keyUiLocale');
                    expect(apiMock.get).to.have.callCount(1);
                });
        });
    });

    describe('getManifest', () => {
        it('should be a function', () => {
            expect(d2.getManifest).to.be.a('function');
        });

        it('should return a promise', () => {
            expect(d2.getManifest()).to.be.instanceof(Promise);
        });

        it('should request the manifest.webapp', (done) => {
            apiMock.get.onFirstCall().returns(Promise.resolve({}));

            d2.getManifest('manifest.webapp')
                .then(() => {
                    expect(apiMock.get).to.be.calledWith('manifest.webapp');
                    done();
                })
                .catch(done);
        });

        it('should return the manifest.webapp object', (done) => {
            const expectedManifest = {
                name: 'MyApp',
            };

            apiMock.get.onFirstCall().returns(Promise.resolve(expectedManifest));

            d2.getManifest('manifest.webapp')
                .then((manifest) => {
                    expect(manifest.name).to.equal(expectedManifest.name);
                    done();
                })
                .catch(done);
        });

        it('should add the getBaseUrl convenience method', (done) => {
            const expectedManifest = {
                name: 'MyApp',
                activities: {
                    dhis: {
                        href: 'http://localhost:8080',
                    },
                },
            };

            apiMock.get.onFirstCall().returns(Promise.resolve(expectedManifest));

            d2.getManifest('manifest.webapp')
                .then((manifest) => {
                    expect(manifest.getBaseUrl()).to.equal('http://localhost:8080');
                    done();
                })
                .catch(done);
        });
    });
});
