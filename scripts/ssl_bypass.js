// SSL Pinning Bypass — Android 13 compatible
// Hooks at both Java and native (OpenSSL/Conscrypt) levels

Java.perform(function() {

    // --- 1. Nuke all TrustManagers ---
    try {
        var arrays = Java.use('java.util.Arrays');
        var ArrayList = Java.use('java.util.ArrayList');
        var X509TrustManager = Java.use('javax.net.ssl.X509TrustManager');
        var SSLContext = Java.use('javax.net.ssl.SSLContext');

        var fakeTM = Java.registerClass({
            name: 'com.pwn.FakeTM',
            implements: [X509TrustManager],
            methods: {
                checkClientTrusted: function(chain, authType) {},
                checkServerTrusted: function(chain, authType) {},
                getAcceptedIssuers: function() { return []; }
            }
        });

        SSLContext.init.overload(
            '[Ljavax.net.ssl.KeyManager;',
            '[Ljavax.net.ssl.TrustManager;',
            'java.security.SecureRandom'
        ).implementation = function(km, tm, sr) {
            this.init(km, [fakeTM.$new()], sr);
        };
        console.log('[+] SSLContext.init hooked');
    } catch(e) { console.log('[-] SSLContext: ' + e); }

    // --- 2. OkHttp3 (multiple versions) ---
    var okhttp_classes = [
        'okhttp3.CertificatePinner',
        'com.squareup.okhttp.CertificatePinner'
    ];
    okhttp_classes.forEach(function(cls) {
        try {
            var Pinner = Java.use(cls);
            Pinner.check.overloads.forEach(function(overload) {
                overload.implementation = function() {
                    console.log('[+] ' + cls + '.check() bypassed');
                };
            });
        } catch(e) {}
    });

    // --- 3. Hostname verifier ---
    try {
        var HostnameVerifier = Java.use('javax.net.ssl.HttpsURLConnection');
        HostnameVerifier.setDefaultHostnameVerifier.implementation = function(v) {};
        console.log('[+] HostnameVerifier bypassed');
    } catch(e) {}

    // --- 4. WebViewClient ---
    try {
        var WebViewClient = Java.use('android.webkit.WebViewClient');
        WebViewClient.onReceivedSslError.overload(
            'android.webkit.WebView',
            'android.webkit.SslErrorHandler',
            'android.net.http.SslError'
        ).implementation = function(wv, handler, err) {
            handler.proceed();
            console.log('[+] WebViewClient SSL error bypassed');
        };
    } catch(e) {}

    // --- 5. Android network_security_config bypass ---
    try {
        var Platform = Java.use('okhttp3.internal.platform.Platform');
        Platform.isCleartextTrafficPermitted.overload('java.lang.String').implementation = function(host) {
            return true;
        };
    } catch(e) {}

    // --- 6. TrustManagerImpl (Conscrypt/Android) ---
    try {
        var TMImpl = Java.use('com.android.org.conscrypt.TrustManagerImpl');
        TMImpl.verifyChain.implementation = function(untrustedChain, trustAnchorChain, host, clientAuth, ocspData, tlsSctData) {
            console.log('[+] Conscrypt verifyChain bypassed for: ' + host);
            return untrustedChain;
        };
    } catch(e) { console.log('[-] Conscrypt verifyChain: ' + e); }

    console.log('\n[✓] All SSL bypass hooks loaded\n');
});
