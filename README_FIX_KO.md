# Jurye 최초 접속 Firestore `permission-denied` 수정

## 원인

기존 `src/firebase/firebase.js`는 Firebase App / Firestore만 초기화하고 Firebase Authentication을 초기화하지 않습니다.
그 상태에서 `index.mjs`가 첫 화면에서 바로 `gameData/wordSets`, `gameData/students`를 Firestore Lite REST로 읽습니다.
Firestore 규칙이 인증을 요구하거나 기존 테스트 규칙이 만료/변경된 경우 요청에 인증 토큰이 없어서 `Missing or insufficient permissions`가 발생합니다.

## 수정 내용

1. `src/firebase/firebase.js`에서 Firebase Anonymous Auth를 초기화합니다.
2. `signInAnonymously()`가 끝날 때까지 top-level `await`로 기다린 후 Firestore/Firestore Lite를 생성합니다.
3. `firestore.rules`를 추가해 현재 앱이 쓰는 컬렉션은 `request.auth != null`일 때만 접근하도록 합니다.
4. `firebase.json`에 Firestore rules 배포 설정을 추가합니다.

## 적용

이 ZIP의 `overlay` 폴더 내용을 Jurye 저장소 루트에 그대로 덮어쓰세요.

### 1) Firebase Console에서 익명 로그인 활성화

Firebase Console → **Authentication** → **Sign-in method** → **Anonymous** → 사용 설정

이 설정이 꺼져 있으면 브라우저 콘솔에 `auth/operation-not-allowed`가 표시됩니다.

### 2) Firestore 규칙 배포

저장소 루트에서 Firebase CLI 로그인 후 실행:

```bash
firebase deploy --only firestore:rules
```

`.firebaserc`의 기본 프로젝트는 `test2222-e2458`입니다. 배포 전에 꼭 프로젝트가 맞는지 확인하세요.

### 3) 웹 파일 배포

GitHub Pages를 쓰는 현재 프로젝트라면 수정 파일을 배포 브랜치에 반영한 뒤 Pages가 다시 배포되게 하면 됩니다.

## 확인 방법

새 시크릿/인코그니토 창에서 접속해 콘솔 순서를 확인하세요.

```text
[Firebase Auth] 익명 인증 준비 완료
[Firebase REST] wordSets 읽기 성공 ...
[Firebase REST] students 읽기 성공 ...
```

`BatchGetDocuments ... permission-denied`가 더 이상 먼저 발생하지 않아야 합니다.

## 보안 메모

이 규칙은 **현재 앱 구조를 깨지 않고 오류를 없애기 위한 호환 규칙**입니다. 익명 인증 사용자는 앱 컬렉션에 접근할 수 있으므로, 교사용 쓰기 권한이나 학생별 데이터 접근을 강하게 제한하려면 이후 Firebase Auth 사용자/Custom Claims 기반 역할 권한으로 분리하는 것을 권장합니다.
