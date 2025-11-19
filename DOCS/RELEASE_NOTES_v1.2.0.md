# Release v1.2.0 - Tampermonkey Script & Project Restructuring

## 🎉 What's New

### Major Features
- **✨ Tampermonkey Userscript**: 새로운 `new.js` 파일 추가 - YouTube 자동 스크립트 표시 기능
- **📁 Project Restructuring**: 개발 문서를 DOCS 폴더로 체계적으로 구성
- **🎯 Enhanced Automation**: YouTube 페이지에서 자동으로 "설명 더보기" 및 "스크립트 표시" 클릭

### Tampermonkey Script Features (new.js)
- **자동 실행**: YouTube 동영상 페이지 접속 시 자동으로 동작
- **스마트 감지**: 페이지 요소를 지능적으로 감지하고 클릭
- **안정성 개선**: 여러 번의 재시도 로직과 에러 처리
- **디버깅 지원**: 콘솔 로그를 통한 상세한 동작 추적

## 📂 Project Structure Improvements

### DOCS Folder Organization
```
DOCS/
├── PRD_API_Model_Selection.md    # 제품 요구사항 문서
├── TRD_API_Model_Selection.md    # 기술 요구사항 문서
├── RELEASE_NOTES.md              # v1.1.0 릴리즈 노트
└── RELEASE_NOTES_v1.2.0.md       # v1.2.0 릴리즈 노트 (현재)
```

## 🛠️ Technical Details

### new.js Userscript Specifications
- **Version**: 0.8.1
- **Platform**: Tampermonkey
- **Browser Support**: Chrome, Edge, Firefox (Tampermonkey 필요)
- **Features**:
  - 자동으로 "설명 더보기" 버튼 클릭
  - "스크립트 표시" 버튼 자동 클릭
  - DOM 변경 감지 및 대응
  - 재시도 로직 (최대 25회)
  - 상세한 콘솔 로깅

### Chrome Extension Components
- 모든 기존 기능 유지
- Google Gemini 3 Pro Preview 지원 유지
- Temperature 1.0 설정 유지

## 📦 Installation Instructions

### Chrome Extension Installation
1. 이전 버전과 동일한 설치 방법
2. `chrome://extensions/`에서 개발자 모드 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. 다운로드한 폴더 선택

### Tampermonkey Script Installation
1. **Tampermonkey 설치**:
   - [Chrome용 Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox용 Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Edge용 Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. **new.js 스크립트 설치**:
   - Tampermonkey 대시보드 열기
   - "새 스크립트 만들기" 클릭
   - `new.js` 파일 내용을 복사하여 붙여넣기
   - 저장 (Ctrl+S 또는 Cmd+S)

3. **사용법**:
   - YouTube 동영상 페이지 접속
   - 자동으로 "설명 더보기" 클릭
   - 자동으로 "스크립트 표시" 버튼 클릭
   - 스크립트/자막이 자동으로 표시됨

## 🔄 Migration from v1.1.0

이전 버전 사용자는 다음과 같이 업그레이드할 수 있습니다:
1. 기존 확장 프로그램 폴더를 새 버전으로 교체
2. API 키 설정은 자동으로 유지됨
3. 선택적으로 Tampermonkey 스크립트 추가 설치

## 📋 Full Feature List

### Chrome Extension Features
- ✅ YouTube 스크립트(자막) AI 요약
- ✅ 댓글 수집 및 AI 요약
- ✅ 다중 AI 모델 지원 (OpenAI o4-mini, Gemini 2.5 Pro, Gemini 3 Pro Preview)
- ✅ YouTube Data API 통합
- ✅ 마크다운 렌더링
- ✅ 로컬 캐싱
- ✅ 클립보드 복사

### Tampermonkey Script Features
- ✅ 자동 "설명 더보기" 클릭
- ✅ 자동 "스크립트 표시" 클릭
- ✅ 페이지 변경 감지
- ✅ 에러 복구 메커니즘
- ✅ 디버깅 로그

## 🐛 Bug Fixes
- 개발 문서 구조 개선으로 프로젝트 관리 용이성 향상
- 파일 구조 정리로 유지보수성 개선

## 🔗 Links
- [GitHub Repository](https://github.com/PLUTO-NIX/YouTube-Script-AI-Summarizer)
- [Issue Tracker](https://github.com/PLUTO-NIX/YouTube-Script-AI-Summarizer/issues)
- [v1.1.0 Release Notes](RELEASE_NOTES.md)

## 📝 Notes for Developers

### Project Files
- **new.js**: Tampermonkey 유저스크립트 (독립 실행 가능)
- **content.js**: Chrome 확장 프로그램의 메인 콘텐츠 스크립트
- **DOCS/**: 모든 개발 및 릴리즈 문서

### Compatibility
- Chrome Extension: Manifest V3
- Tampermonkey Script: Userscript API v0.8.1
- 두 컴포넌트는 독립적으로 동작하며 함께 사용 가능

## 🙏 Acknowledgments
- Tampermonkey 커뮤니티
- YouTube API 팀
- 모든 기여자와 사용자들

---

**⭐ 이 프로젝트가 유용하다면 GitHub에서 스타를 눌러주세요!**

**🚀 Happy YouTubing with AI-powered summaries and automation!**
