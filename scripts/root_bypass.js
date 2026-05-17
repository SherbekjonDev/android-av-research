Java.perform(function () {
    var PostLogin = Java.use('com.android.insecurebankv2.PostLogin');

    PostLogin.doesSUexist.implementation = function () {
        console.log('[+] doesSUexist() hooked — returning true');
        return true;
    };

    PostLogin.doesSuperuserApkExist.implementation = function (s) {
        console.log('[+] doesSuperuserApkExist() hooked — returning true');
        return true;
    };

    console.log('[✓] Root detection bypass loaded — device will appear rooted');
});
