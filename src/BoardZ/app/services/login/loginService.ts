import {Injectable} from 'angular2/core';
import {Http, Headers, RequestOptions} from 'angular2/http';
import {Router} from 'angular2/router';

import {Observable} from 'rxjs/Observable';
import {Subject} from 'rxjs/Subject';

import {Configuration} from '../../app-config';
import {Logger} from '../logging/logger';
import {TokenDataStore} from './tokenDataStore';

interface TokenData {
    access_token: string;
    token_type: string;
    expires_in: number;
}

@Injectable()
export class LoginService {

    private _lastLoginUnsuccessful: boolean = false;

    get authenticated(): boolean {
        return this._tokenStore.token !== null;
    }

    get username(): string {
        return this._tokenStore.username;
    }

    get isLoggedIn(): boolean {
        return this._tokenStore.token !== null;
    }

    constructor(
        private _config: Configuration,
        private _logger: Logger,
        private _http: Http,
        private _router: Router,
        private _tokenStore: TokenDataStore)
    {
        this._tokenStore.check()
            .subscribe((value) => { if (!value) this.unauthenticate(); });
    }

    unauthenticate() : void {
        this._logger.logDebug('LoginService.unauthenticate called');
        this._lastLoginUnsuccessful = false;
        this._tokenStore.token = null;

        this._router.navigate(['Login']);
    }

    authenticate (username: string, password: string): Observable<TokenData> {
        this.unauthenticate();

        let body = 'grant_type=password&username=' + username + '&password=' + password,
            options = new RequestOptions( { headers: new Headers({'Content-Type': 'application/x-www-form-urlencoded'})}),
            request = this._http.post(this._config.apiEndpoint + 'token', body, options)
                .map(response => <TokenData>response.json()),
            multiplexer = new Subject<TokenData>();

        // need to subscribe via a relay object as multiple subscriptions on the request object
        // will cause multiple requests
        multiplexer.subscribe(
            tokenData => {
                this.saveToken(tokenData.access_token);
                this._tokenStore.username = username;

                let expiryDate = new Date();
                expiryDate.setSeconds(expiryDate.getSeconds() + tokenData.expires_in);
                this._tokenStore.tokenExpiry = expiryDate;
            },
            error => this.handleError(error)
        );

        request.subscribe(multiplexer);
        return multiplexer;
    }

    handleError (error: TokenData) {
        this._logger.logDebug('LoginService encountered an error: ' + error);

        this._lastLoginUnsuccessful = true;
    }

    saveToken (token: string): void {
        this._logger.logVerbose('LoginService.saveToken: Saving token ' + token);

        this._lastLoginUnsuccessful = false;
        this._tokenStore.token = token;
    }
}
