# MIN IMA 배포

Node.js 22에서 `npm ci`, `npm run lint`, `npm run build`로 검증합니다.
Cloudflare Pages에 업로드할 폴더는 `dist`입니다.

## Firebase

앱은 이미 `firebase-applet-config.json`을 통해 다음 리소스에 연결되어 있습니다.

- 프로젝트: `gen-lang-client-0592503035`
- Firestore: `ai-studio-fe113285-1a1f-4488-8c3c-d5a998d04273`

Firebase 콘솔의 Authentication에서 Google 로그인을 활성화합니다.
Settings → Authorized domains에 실제 Pages 도메인과 사용자 지정 도메인을 추가합니다.
도메인에는 `https://`나 경로를 넣지 않습니다.
웹 설정은 공개 설정이며 서비스 계정 키는 프런트엔드에 넣지 않습니다.
Firebase Storage 업로드는 현재 구현되어 있지 않습니다.

Firestore 규칙은 기존 접근 정책을 포함하므로 웹 앱 배포와 별도로 검토하고 배포합니다.

```sh
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project gen-lang-client-0592503035
```

CI에서 Firebase CLI 인증을 구성할 경우 Application Default Credentials를 사용합니다.

## Cloudflare GitHub 자동 배포

Cloudflare Pages의 min-ima 프로젝트는 crucify87/MIN-IMA 저장소에 직접 연결되어 있습니다.
main 브랜치에 push하면 Cloudflare가 빌드하고 배포합니다.

- 빌드 명령은 npm run build입니다.
- 빌드 출력 디렉터리는 dist입니다.
- 루트 디렉터리는 저장소 루트입니다.
- 운영 주소는 https://min-ima.pages.dev 입니다.

GitHub Actions는 타입 검사와 빌드 검증만 수행합니다.
배포 상태와 로그는 Cloudflare의 Workers 및 Pages → min-ima → 배포에서 확인합니다.
