# 🔧 BookPlay Firebase 설정 가이드

이 가이드를 따라 Firebase 프로젝트를 설정하고 BookPlay 앱을 실행해보세요.

## 📋 체크리스트

- [ ] Firebase 프로젝트 생성
- [ ] Authentication 서비스 활성화
- [ ] Google 로그인 제공업체 설정
- [ ] 웹 앱 등록
- [ ] 설정 정보 업데이트
- [ ] 로컬 테스트
- [ ] 배포 (선택사항)

## 🚀 단계별 설정

### 1단계: Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. **"프로젝트 추가"** 클릭
3. 프로젝트 정보 입력:
   ```
   프로젝트 이름: bookplay-production (또는 원하는 이름)
   프로젝트 ID: bookplay-production-xxxxx (자동 생성)
   ```
4. Google Analytics 설정 (선택사항)

### 2단계: Authentication 서비스 활성화

1. Firebase Console에서 **Authentication** 클릭
2. **시작하기** 버튼 클릭
3. **Sign-in method** 탭으로 이동
4. **Google** 제공업체 클릭
5. **사용 설정** 토글 활성화
6. 프로젝트 지원 이메일 입력
7. **저장** 클릭

### 3단계: 웹 앱 등록

1. **프로젝트 개요** → **앱 추가** → **웹** (</> 아이콘) 클릭
2. 앱 정보 입력:
   ```
   앱 닉네임: BookPlay Web App
   ✅ 이 앱의 Firebase Hosting도 설정합니다 (체크)
   ```
3. **앱 등록** 클릭
4. **설정 정보 복사** (다음 단계에서 사용)

### 4단계: 설정 정보 업데이트

복사한 Firebase 설정 정보를 사용하여 `public/js/firebase-config.js` 파일을 업데이트하세요:

```javascript
// 현재 파일 내용 (업데이트 필요)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",                    // ← 실제 값으로 변경
  authDomain: "bookplay-production.firebaseapp.com",
  projectId: "bookplay-production",
  storageBucket: "bookplay-production.appspot.com",
  messagingSenderId: "902982228800",
  appId: "YOUR_APP_ID"                      // ← 실제 값으로 변경
};
```

**실제 설정 예시:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "bookplay-production-12345.firebaseapp.com",
  projectId: "bookplay-production-12345",
  storageBucket: "bookplay-production-12345.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789"
};
```

### 5단계: 승인된 도메인 설정

1. **Authentication** → **설정** → **승인된 도메인**
2. 기본적으로 다음 도메인들이 추가되어 있어야 합니다:
   ```
   ✅ localhost (로컬 개발용)
   ✅ your-project-id.firebaseapp.com
   ✅ your-project-id.web.app
   ```

### 6단계: 로컬 테스트

#### 방법 1: Python 사용 (권장)
```bash
cd public
python -m http.server 8000
```

#### 방법 2: Node.js 사용
```bash
cd public
npx serve -s . -p 8000
```

#### 방법 3: VS Code Live Server
VS Code에서 `public/index.html` 파일을 우클릭 → "Open with Live Server"

브라우저에서 `http://localhost:8000` 접속하여 테스트

### 7단계: 배포 (선택사항)

#### Firebase CLI 설치
```bash
npm install -g firebase-tools
firebase login
```

#### 프로젝트 초기화
```bash
firebase init hosting
# 설정 선택:
# - 기존 프로젝트 사용
# - public 폴더 선택
# - SPA로 구성: Yes
# - 기존 index.html 덮어쓰기: No
```

#### 배포 실행
```bash
firebase deploy --only hosting
```

## 🧪 테스트 체크리스트

로컬 테스트 시 다음 사항들을 확인하세요:

- [ ] 페이지가 정상적으로 로드되는가?
- [ ] "Google로 로그인" 버튼이 보이는가?
- [ ] 로그인 버튼 클릭 시 Google 로그인 팝업이 나타나는가?
- [ ] 로그인 성공 후 사용자 정보가 표시되는가?
- [ ] 로그아웃 버튼이 정상 작동하는가?
- [ ] 브라우저 개발자 도구에 에러가 없는가?

## 🔍 문제 해결

### 로그인 팝업이 차단되는 경우
- 브라우저의 팝업 차단 설정을 확인하세요
- Chrome: 주소창 오른쪽의 팝업 차단 아이콘 클릭

### "Firebase: Error (auth/unauthorized-domain)" 에러
- Firebase Console → Authentication → 설정 → 승인된 도메인에 현재 도메인 추가

### "Firebase: No Firebase App '[DEFAULT]' has been created" 에러
- `firebase-config.js` 파일의 설정 정보가 올바른지 확인
- 브라우저 캐시를 지우고 다시 시도

### 네트워크 에러
- 인터넷 연결 상태 확인
- 방화벽이나 보안 프로그램이 Firebase 도메인을 차단하지 않는지 확인

## 📞 추가 도움이 필요하다면

1. [Firebase 공식 문서](https://firebase.google.com/docs/auth)
2. [Firebase Authentication 가이드](https://firebase.google.com/docs/auth/web/start)
3. 브라우저 개발자 도구의 Console 탭에서 에러 메시지 확인

---

**설정 완료 후 BookPlay의 모든 기능을 사용할 수 있습니다! 🎉**
