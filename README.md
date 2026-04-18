# 📚 BookPlay - Firebase Authentication 웹 앱

Firebase Authentication을 사용한 정적 웹 애플리케이션입니다.

> **📋 작업 계획(TODO/ROADMAP)은 [BookPlay-Pro/docs/ROADMAP.md](https://github.com/blcktgr73/BookPlay-Pro/blob/main/docs/ROADMAP.md)에서 통합 관리합니다.**
> Android 앱과 Firebase 서버를 한 곳에서 관리합니다.

> 📋 Cross-project 운영 / 보안 / 정책은 [palab-platform](https://github.com/blcktgr73/palab-platform) (Private)에서 통합 관리됩니다.

## 🚀 프로젝트 개요

BookPlay는 Firebase Authentication만을 사용하여 구현된 정적 웹 애플리케이션입니다. Google 계정을 통한 간편 로그인과 사용자 정보 관리 기능을 제공합니다.

## 📁 프로젝트 구조

```
bookplay-prod/
├── public/                 # 정적 파일들
│   ├── index.html         # 메인 HTML 페이지
│   ├── js/                # JavaScript 모듈들
│   │   ├── firebase-config.js  # Firebase 설정
│   │   ├── auth.js            # 인증 로직
│   │   └── app.js             # 메인 앱 로직
│   ├── css/               # 스타일 파일들
│   │   └── style.css      # 메인 스타일시트
│   └── assets/            # 이미지 및 기타 자원
│       └── default-avatar.svg  # 기본 아바타 이미지
├── firebase.json          # Firebase 배포 설정
├── firebase-debug.log     # Firebase 디버그 로그
└── README.md             # 프로젝트 설명
```

## 🔧 설정 방법

### 1. Firebase 프로젝트 설정

1. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트 생성
2. Authentication 서비스 활성화
3. Google 로그인 제공업체 설정
4. 웹 앱 등록 후 설정 정보 확인

### 2. Firebase 설정 업데이트

`public/js/firebase-config.js` 파일에서 다음 정보를 실제 값으로 업데이트:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",                    // ← 실제 API 키로 변경
  authDomain: "bookplay-production.firebaseapp.com",
  projectId: "bookplay-production",
  storageBucket: "bookplay-production.appspot.com",
  messagingSenderId: "902982228800",
  appId: "YOUR_APP_ID"                      // ← 실제 앱 ID로 변경
};
```

### 3. 로컬 테스트

```bash
# Python을 사용한 간단한 HTTP 서버
cd public
python -m http.server 8000

# 또는 Node.js 사용
npx serve -s . -p 8000
```

브라우저에서 `http://localhost:8000` 접속하여 테스트

## 🚀 배포 방법

### Firebase CLI 설치 및 로그인

```bash
# Firebase CLI 설치
npm install -g firebase-tools

# Firebase 로그인
firebase login

# 프로젝트 확인
firebase projects:list
```

### 배포 실행

```bash
# 배포 전 미리보기 (선택사항)
firebase serve --only hosting

# 실제 배포
firebase deploy --only hosting
```

## ✨ 주요 기능

- 🔐 **Google 인증**: Firebase Authentication을 통한 안전한 로그인
- 📱 **반응형 디자인**: 모바일과 데스크톱 모두 지원
- 🎨 **모던 UI**: 깔끔하고 직관적인 사용자 인터페이스
- ⚡ **빠른 로딩**: 정적 파일 기반의 빠른 성능
- 🌙 **다크 모드**: 시스템 설정에 따른 자동 다크 모드 지원
- ♿ **접근성**: 키보드 네비게이션 및 스크린 리더 지원

## 🛠️ 기술 스택

- **Frontend**: HTML5, CSS3, ES6+ JavaScript
- **인증**: Firebase Authentication
- **배포**: Firebase Hosting
- **스타일링**: CSS Grid, Flexbox, CSS Variables
- **아이콘**: 이모지 기반 아이콘 시스템

## 📝 주요 파일 설명

### JavaScript 모듈

- **firebase-config.js**: Firebase 초기화 및 설정
- **auth.js**: 인증 관련 함수들 (로그인, 로그아웃, 상태 감지)
- **app.js**: 메인 애플리케이션 로직 및 DOM 조작

### CSS 특징

- CSS Variables를 활용한 테마 시스템
- 모바일 우선 반응형 디자인
- 접근성을 고려한 포커스 스타일
- 다크 모드 지원
- 부드러운 애니메이션 및 트랜지션

## 🔒 보안 고려사항

- Firebase Security Rules 설정 필요시 추가 구성
- HTTPS 강제 사용 (Firebase Hosting 기본 제공)
- 클라이언트 사이드 인증만 사용 (서버 검증 필요시 추가 구현)

## 📈 확장 가능성

현재는 Firebase Authentication만 사용하지만, 필요에 따라 다음 기능들을 추가할 수 있습니다:

- **Firestore**: 사용자 데이터 저장
- **Cloud Functions**: 서버사이드 로직
- **Firebase Storage**: 파일 업로드
- **Analytics**: 사용자 행동 분석

## 🐛 문제 해결

### 로그인 팝업이 차단되는 경우
- 브라우저의 팝업 차단 설정 확인
- `signInWithRedirect` 방식으로 변경 고려

### CORS 에러 발생시
- Firebase Console에서 승인된 도메인 확인
- 로컬 테스트시 `localhost` 도메인 추가

## 📞 지원

문제가 발생하거나 질문이 있으시면 다음을 확인해보세요:

1. [Firebase 공식 문서](https://firebase.google.com/docs)
2. 브라우저 개발자 도구의 콘솔 에러 메시지
3. Firebase Console의 Authentication 로그

## 📄 라이선스

이 프로젝트는 교육 목적으로 제작되었습니다.

---

**Made with ❤️ and Firebase**
