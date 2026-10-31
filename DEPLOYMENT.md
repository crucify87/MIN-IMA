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

## Cloudflare 최초 설정

1. Cloudflare에서 Direct Upload 방식의 Pages 프로젝트를 만들고 production branch를 `main`으로 설정합니다.
2. 이름은 `min-ima`를 사용합니다. 다른 이름이면 `wrangler.toml`의 name도 변경합니다.
3. 해당 계정의 Cloudflare Pages 편집 권한을 가진 API 토큰을 발급합니다.
4. GitHub 저장소 Settings → Secrets and variables → Actions에 아래 값을 등록합니다.

| 종류 | 이름 | 값 |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | Pages 편집 토큰 |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID |
| Variable | `CLOUDFLARE_PAGES_PROJECT` | 실제 Pages 프로젝트명 |

5. 설정을 GitHub에 반영한 뒤 Actions의 Build and deploy MIN IMA를 실행하거나 main에 push합니다.
6. 실제 배포 도메인을 Firebase Authorized domains에 등록하고 로그인 및 데이터 조회를 확인합니다.

이후 main push마다 타입 검사 → 빌드 → Pages 배포가 실행됩니다.
Pull request에서는 검사와 빌드만 실행합니다.
중복 배포를 피하려면 Cloudflare의 별도 Git 자동 빌드를 함께 활성화하지 않습니다.
이 설정 파일만으로 계정 인증이나 Pages 프로젝트 생성이 완료되지는 않습니다.

## 공식 문서

- [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Wrangler Action](https://github.com/cloudflare/wrangler-action)
- [Firebase CLI](https://firebase.google.com/docs/cli)
