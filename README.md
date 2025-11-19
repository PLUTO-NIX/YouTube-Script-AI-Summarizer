# YouTube Script AI Summarizer

YouTube 동영상의 스크립트(자막)와 댓글을 AI로 자동 요약해주는 Chrome 확장 프로그램입니다.

## ✨ 주요 기능

### 🎯 핵심 기능
- **스크립트 요약**: YouTube 동영상의 자막을 AI로 요약
- **댓글 요약**: 댓글과 답글을 수집하고 AI로 분석하여 요약  
- **다중 AI 모델 지원**: OpenAI와 Google Gemini API 지원
- **스마트 UI**: YouTube 스크립트 패널에 통합된 탭 인터페이스

### 🔧 고급 기능
- **YouTube Data API 통합**: 모든 댓글을 빠르게 수집 (스크롤 불필요)
- **마크다운 렌더링**: 요약 결과를 깔끔한 마크다운으로 표시
- **클립보드 복사**: 요약 내용을 원클릭으로 복사
- **로컬 캐싱**: 요약 결과를 로컬에 저장하여 재사용
- **실시간 진행률**: 댓글 수집 및 AI 처리 진행 상황 표시

## 🚀 지원되는 AI 모델

| 모델 | 제공사 | 특징 |
|-----|-------|------|
| **o4-mini** | OpenAI | 빠르고 경제적인 기본 모델 |
| **Gemini 2.5 Pro** | Google | 최신 고성능 모델 |
| **Gemini 3 Pro Preview** | Google | 최신 프리뷰 버전 (창의적인 응답) |

## 📦 설치 방법

### 1. Chrome Web Store에서 설치 (권장)
_(준비 중)_

### 2. 개발자 모드로 설치

1. 이 저장소를 다운로드하거나 클론합니다
```bash
git clone https://github.com/PLUTO-NIX/YouTube-Script-AI-Summarizer.git
```

2. Chrome 브라우저에서 `chrome://extensions/` 페이지로 이동
3. 우상단의 "개발자 모드" 토글을 활성화
4. "압축해제된 확장 프로그램을 로드합니다" 클릭
5. 다운로드한 폴더를 선택

## ⚙️ 설정 방법

### 1. API 키 발급

사용하려는 AI 모델에 따라 API 키를 발급받아야 합니다.

#### OpenAI API 키
1. [OpenAI Platform](https://platform.openai.com/)에서 계정 생성
2. API Keys 섹션에서 새 키 생성
3. 생성된 키를 복사 (sk-로 시작)

#### Google Gemini API 키
1. [Google AI Studio](https://aistudio.google.com/)에서 API 키 생성
2. 생성된 키를 복사 (AIza-로 시작)

#### YouTube Data API 키 (선택사항)
댓글 요약 기능을 향상시키려면 YouTube Data API 키를 추가로 설정할 수 있습니다.

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "API 및 서비스" > "라이브러리"에서 "YouTube Data API v3" 활성화
4. "사용자 인증 정보"에서 API 키 생성

### 2. 확장 프로그램 설정

1. 확장 프로그램 아이콘 클릭 → "Open Settings"
2. API 키들을 입력
3. 원하는 AI 모델 선택
4. 필요시 커스텀 프롬프트 설정
5. "Save Settings" 클릭

## 🎮 사용 방법

### 1. 스크립트 요약
1. YouTube 동영상 페이지로 이동
2. 스크립트(자막) 패널 열기
3. "AI 요약" 탭 클릭
4. 자동으로 생성되는 요약 확인

### 2. 댓글 요약
1. 동일한 스크립트 패널에서
2. "댓글 요약" 탭 클릭
3. 자동으로 댓글 수집 및 분석 시작
4. 생성된 댓글 요약 확인

### 3. 추가 기능
- **새로고침**: 우상단 새로고침 버튼으로 요약 재생성
- **복사**: 복사 버튼으로 요약 내용을 클립보드에 복사
- **저장**: 요약은 자동으로 로컬에 저장되어 재방문 시 빠르게 로드

## 🏗️ 프로젝트 구조

```
YouTube Script AI Summarizer/
├── manifest.json          # 확장 프로그램 설정
├── background.js          # 서비스 워커 (API 호출 관리)
├── content.js             # 메인 로직 (YouTube 페이지 통합)
├── new.js                # Tampermonkey 유저스크립트 (자동 스크립트 표시)
├── popup.html/js/css      # 팝업 UI
├── options.html/js/css    # 설정 페이지
├── style.css             # 스타일시트
├── images/               # 아이콘 파일들
├── DOCS/                 # 개발 문서
│   ├── PRD_API_Model_Selection.md
│   ├── TRD_API_Model_Selection.md
│   └── RELEASE_NOTES.md
├── README.md             # 프로젝트 문서
├── LICENSE              # MIT 라이선스
└── .gitignore           # Git 제외 파일
```

## 🔧 개발자 정보

### 기술 스택
- **플랫폼**: Chrome Extension (Manifest V3)
- **언어**: JavaScript (ES6+), HTML5, CSS3
- **API**: OpenAI GPT API, Google Gemini API, YouTube Data API v3
- **아키텍처**: 서비스 워커 기반

### 주요 컴포넌트
- **background.js**: AI API 호출을 처리하는 서비스 워커
- **content.js**: YouTube 페이지에 UI를 삽입하고 사용자 인터랙션 관리 (2800+ 줄)
- **popup.js**: 확장 프로그램 팝업 인터페이스
- **options.js**: 설정 페이지 로직

### 특별한 기술적 특징
- **DOM 기반 댓글 수집**: YouTube Data API 없이도 동작하는 폴백 시스템
- **스마트 UI 복구**: YouTube SPA 환경에서 UI 상태 자동 복구
- **마크다운 파싱**: 커스텀 마크다운 렌더러로 요약 결과 포맷팅
- **Progressive Enhancement**: API 키 설정에 따라 기능이 점진적으로 향상

## 🚨 제한사항 및 주의사항

1. **API 비용**: AI 모델 사용 시 각 서비스의 요금제에 따라 비용 발생
2. **스크립트 의존성**: 자막이 없는 동영상은 요약 불가
3. **브라우저 지원**: Chrome/Edge 기반 브라우저에서만 동작
4. **YouTube 정책**: YouTube의 DOM 구조 변경 시 업데이트 필요

## 🆘 문제 해결

### 자주 묻는 질문

**Q: 스크립트를 찾을 수 없다고 나와요**  
A: YouTube 동영상에 자막이 활성화되어 있는지 확인하고, 스크립트 패널을 먼저 열어주세요.

**Q: API 키를 입력했는데 작동하지 않아요**  
A: 설정 페이지에서 올바른 형식의 API 키인지 확인하고, 해당 AI 모델이 선택되어 있는지 확인하세요.

**Q: 댓글 요약이 너무 오래 걸려요**  
A: YouTube Data API 키를 설정하면 훨씬 빠르게 동작합니다. DOM 기반 수집은 시간이 더 소요됩니다.

## 📝 업데이트 내역

### v1.2.0 (2025-11-19)
- ✨ Tampermonkey 유저스크립트 추가 (new.js)
- 📁 개발 문서를 DOCS 폴더로 구조 개선
- 🎯 YouTube 자동 스크립트 표시 기능 추가
- 📋 더 나은 프로젝트 구조화

### v1.1.0 (2025-01-19)
- ✨ Google Gemini 3 Pro Preview 모델 추가
- 🔧 Temperature 설정 최적화 (1.0으로 조정)
- 📝 문서 업데이트 및 개선

### v1.0.0 (초기 릴리즈)
- 🚀 YouTube 스크립트 AI 요약 기능
- 💬 댓글 수집 및 요약 기능
- 🤖 다중 AI 모델 지원 (OpenAI, Gemini)
- 🎨 YouTube UI에 통합된 인터페이스

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🤝 기여하기

버그 리포트, 기능 제안, 풀 리퀘스트를 환영합니다!

1. 이 저장소를 포크하세요
2. 새 기능 브랜치를 생성하세요 (`git checkout -b feature/AmazingFeature`)
3. 변경사항을 커밋하세요 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 푸시하세요 (`git push origin feature/AmazingFeature`)
5. 풀 리퀘스트를 생성하세요

## 📞 연락처

프로젝트 관련 문의사항이나 버그 리포트는 [GitHub Issues](https://github.com/PLUTO-NIX/YouTube-Script-AI-Summarizer/issues)를 통해 제출해 주세요.

---

**⭐ 이 프로젝트가 유용하다면 스타를 눌러주세요!**
