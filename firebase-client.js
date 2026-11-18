/* Digital safety personal board v1 - Firestore compat CDN; shared by student and teacher pages */
(function(){
  'use strict';
  const config=window.DS_FIREBASE_CONFIG||{};
  const available=Boolean(config.apiKey&&config.projectId&&config.authDomain&&config.appId);
  window.DSDB={ available, ready:null, auth:null, db:null, studentDoc:null, settingsDoc:null, submissions:null, teacherUid:window.DS_TEACHER_UID||'' };
  if(!available){window.DSDB.ready=Promise.reject(new Error('Firebase 설정이 아직 입력되지 않았습니다.'));window.DSDB.ready.catch(()=>{});return;}
  try{
    firebase.initializeApp(config);
    const auth=firebase.auth(),db=firebase.firestore();
    window.DSDB.auth=auth;window.DSDB.db=db;
    // Anonymous sessions are for submitting and reading. Never silently downgrade a signed-in teacher.
    window.DSDB.ensureSignedIn=async function(){
      if(auth.currentUser)return auth.currentUser;
      const result=await auth.signInAnonymously();
      return result.user;
    };
    window.DSDB.submissions=db.collection('dsPromiseSessions').doc('current').collection('submissions');
    window.DSDB.settingsDoc=db.collection('dsPromiseSessions').doc('current').collection('settings').doc('main');
    window.DSDB.ready=Promise.resolve();
  }catch(e){window.DSDB.ready=Promise.reject(e);window.DSDB.ready.catch(()=>{});}
})();
