// content.js

// --- 전역 변수 및 상수 ---
const SUMMARY_TAB_ID = 'ai-summary-tab';
const SCRIPT_TAB_ID = 'script-tab';
const COMMENTS_TAB_ID = 'comments-summary-tab';
const SUMMARY_CONTENT_ID = 'ai-summary-content';
const COMMENTS_CONTENT_ID = 'comments-summary-content';
// const SCRIPT_CONTENT_ID = 'youtube-script-content'; // 이 ID의 div는 이제 내용을 직접 담지 않을 수 있음
const UI_CONTAINER_ID = 'youtube-ai-summary-ui-container';
const REFRESH_BUTTON_ID = 'ai-summary-refresh-button';
const COMMENTS_REFRESH_BUTTON_ID = 'comments-summary-refresh-button';

// AI 모델 설정 상수
const AI_MODELS = {
    'openai-o4-mini': {
        id: 'openai-o4-mini',
        name: 'OpenAI o4-mini',
        provider: 'openai',
        model: 'o4-mini',
        apiKeyRequired: 'openai_api_key',
        maxTokens: 30000,
        temperature: 0.7,
        endpoint: 'https://api.openai.com/v1/chat/completions'
    },
    'gemini-2.5-pro': {
        id: 'gemini-2.5-pro',
        name: 'Google Gemini 2.5 Pro',
        provider: 'gemini',
        model: 'gemini-2.5-pro',
        apiKeyRequired: 'gemini_api_key',
        maxTokens: 32000,
        temperature: 0.7,
        endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent'
    },
    'gemini-3-pro-preview': {
        id: 'gemini-3-pro-preview',
        name: 'Google Gemini 3 Pro Preview',
        provider: 'gemini',
        model: 'gemini-3-pro-preview',
        apiKeyRequired: 'gemini_api_key',
        maxTokens: 32000,
        temperature: 1,
        endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-3-pro-preview:generateContent'
    }
};

// 댓글 관련 선택자들
const COMMENT_SELECTORS = {
    commentSection: '#comments',
    sortButton: '#sort-menu-button',
    topCommentsOption: 'tp-yt-paper-listbox #menu-item-1',
    commentItems: 'ytd-comment-thread-renderer',
    commentText: '#content-text',
    replyButton: '#show-replies-button',
    replyItems: 'ytd-comment-renderer',
    authorName: '#author-text span',
    likeCount: '#vote-count-middle',
    moreRepliesButton: '#show-replies-button'
};

let currentVideoId = null;
let openAIKey = null;
let userPrompt = `다음은 YouTube 동영상의 스크립트(자막) 내용입니다. 이 내용을 바탕으로 다음과 같이 요약해 주세요:

1. 핵심 주제와 메인 아이디어를 간결하게 정리
2. 중요한 포인트들을 순서대로 나열
3. 전체적인 결론이나 메시지를 포함
4. 가능하면 실용적인 정보나 팁이 있다면 별도로 언급

요약은 한국어로 작성하고, 불필요한 반복이나 부가 설명은 제외해 주세요:`; // 개선된 기본 프롬프트

let commentsPrompt = `다음은 YouTube 동영상의 댓글들입니다. 이 댓글들을 분석하여 다음과 같이 요약해 주세요:

1. 전반적인 시청자 반응과 감정 (긍정적/부정적/중립적)
2. 가장 많이 언급되는 주요 논점이나 이슈들
3. 시청자들이 공감하거나 관심있어하는 내용들
4. 건설적인 비판이나 제안사항들
5. 전체적인 댓글의 분위기와 특징

댓글 요약은 한국어로 작성하고, 욕설이나 부적절한 내용은 제외해 주세요:`;

// YouTube의 스크립트 관련 주요 DOM 요소 참조
let ytTranscriptRendererElement = null; // ytd-transcript-renderer
let ytTranscriptContentElement = null; // YouTube 자체 스크립트 내용 컨테이너 (예: div#content.ytd-transcript-renderer)
let ytTranscriptSegmentsContainer = null; // 스크립트 세그먼트들의 실제 부모 (예: #segments-container)

// UI 복구를 위한 주기적 체크
let uiCheckInterval = null;

// 이벤트 리스너 참조를 저장할 변수들
let tabChangeClickListener = null;
let tabChangeKeyListener = null;

// 클립보드 복사를 위한 원본 텍스트 저장 변수
let currentSummaryText = '';
let currentCommentsSummaryText = '';

// 댓글 수집 관련 변수들
let isCollectingComments = false;
let collectedComments = [];
let commentCollectionProgress = { current: 0, total: 100 };

// API 요청 타이머 관련 변수들
let loadingTimer = null;
let loadingStartTime = null;
let commentsLoadingTimer = null;
let commentsLoadingStartTime = null;

// --- 초기화 및 UI 삽입 로직 ---

/**
 * 확장 프로그램 UI를 페이지에 삽입합니다.
 * ytd-transcript-renderer가 나타난 후 호출됩니다.
 * @param {HTMLElement} transcriptRenderer - ytd-transcript-renderer 요소
 */
function injectUI(transcriptRenderer) {
    ytTranscriptRendererElement = transcriptRenderer; // 참조 저장

    // 1. 스크립트 패널 내부의 실제 콘텐츠 영역 찾기
    ytTranscriptContentElement = transcriptRenderer.querySelector('div#content.ytd-transcript-renderer');
    ytTranscriptSegmentsContainer = transcriptRenderer.querySelector('#segments-container.ytd-transcript-segment-list-renderer, ytd-transcript-segment-list-renderer');

    if (!ytTranscriptContentElement) {
        console.warn('[AI 요약] YouTube 스크립트 내용 컨테이너(div#content)를 찾을 수 없습니다.');
        return;
    }

    if (!ytTranscriptSegmentsContainer) {
        console.warn('[AI 요약] YouTube 스크립트 세그먼트 컨테이너를 찾을 수 없습니다.');
    }

    // 2. 이미 UI가 삽입되었는지 확인 (중복 삽입 방지)
    if (document.getElementById(UI_CONTAINER_ID)) {
        console.log('[AI 요약] UI가 이미 존재합니다.');
        updateUIForNewVideo(); // 비디오 변경 시 내용 업데이트 로직 호출
        return;
    }

    // 3. 탭 버튼들 생성
    const tabsContainer = document.createElement('div');
    tabsContainer.classList.add('yt-ai-summary-tabs');

    // 탭 버튼들을 감싸는 왼쪽 컨테이너
    const tabsLeftContainer = document.createElement('div');
    tabsLeftContainer.classList.add('yt-ai-summary-tabs-left');

    const scriptTabButton = document.createElement('button');
    scriptTabButton.id = SCRIPT_TAB_ID;
    scriptTabButton.textContent = '스크립트';
    scriptTabButton.classList.add('yt-ai-summary-tab-button', 'active');

    const summaryTabButton = document.createElement('button');
    summaryTabButton.id = SUMMARY_TAB_ID;
    summaryTabButton.textContent = 'AI 요약';
    summaryTabButton.classList.add('yt-ai-summary-tab-button');

    const commentsTabButton = document.createElement('button');
    commentsTabButton.id = COMMENTS_TAB_ID;
    commentsTabButton.textContent = '댓글 요약';
    commentsTabButton.classList.add('yt-ai-summary-tab-button');

    tabsLeftContainer.appendChild(scriptTabButton);
    tabsLeftContainer.appendChild(summaryTabButton);
    tabsLeftContainer.appendChild(commentsTabButton);

    // 버튼 컨테이너 생성 (복사 + 새로고침 버튼들을 위한)
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 8px;
        align-items: center;
    `;

    // 복사 버튼 생성
    const copyButton = document.createElement('button');
    copyButton.id = 'ai-summary-copy-button';
    copyButton.classList.add('yt-ai-summary-copy-button');
    copyButton.title = '요약 내용 복사';
    copyButton.disabled = true; // 초기에는 비활성화

    // 인라인 스타일 강제 적용 (YouTube CSS 간섭 방지)
    copyButton.style.cssText = `
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        padding: 8px !important;
        border-radius: 4px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        min-height: 32px !important;
        max-width: 32px !important;
        max-height: 32px !important;
        visibility: visible !important;
        opacity: 0.5 !important;
        position: relative !important;
        overflow: visible !important;
        box-sizing: border-box !important;
        color: var(--yt-spec-text-secondary) !important;
        transition: all 0.2s ease !important;
        margin: 0 !important;
        outline: none !important;
        transform: none !important;
        filter: none !important;
        flex-shrink: 0 !important;
        flex-grow: 0 !important;
        flex-basis: auto !important;
    `;

    // 복사 아이콘 SVG
    copyButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px !important; height: 16px !important; display: block !important; visibility: visible !important; opacity: 1 !important; pointer-events: none !important; stroke: currentColor !important; fill: none !important;">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
    `;

    // 새로고침 버튼을 탭바 우측에 배치
    const refreshButton = document.createElement('button');
    refreshButton.id = REFRESH_BUTTON_ID;
    refreshButton.classList.add('yt-ai-summary-refresh-button');
    refreshButton.title = '요약 새로고침';

    // 인라인 스타일 강제 적용 (YouTube CSS 간섭 방지)
    refreshButton.style.cssText = `
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        padding: 8px !important;
        border-radius: 4px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        min-height: 32px !important;
        max-width: 32px !important;
        max-height: 32px !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        overflow: visible !important;
        box-sizing: border-box !important;
        color: var(--yt-spec-text-secondary) !important;
        transition: all 0.2s ease !important;
        margin: 0 !important;
        outline: none !important;
        transform: none !important;
        filter: none !important;
        flex-shrink: 0 !important;
        flex-grow: 0 !important;
        flex-basis: auto !important;
    `;

    // Lucide 새로고침 아이콘 SVG 추가
    refreshButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px !important; height: 16px !important; display: block !important; visibility: visible !important; opacity: 1 !important; pointer-events: none !important; stroke: currentColor !important; fill: none !important; transform: none !important; filter: none !important;">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
            <path d="M21 3v5h-5"></path>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
            <path d="M3 21v-5h5"></path>
        </svg>
    `;

    // 버튼들을 컨테이너에 추가
    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(refreshButton);

    tabsContainer.appendChild(tabsLeftContainer);
    tabsContainer.appendChild(buttonContainer);

    // AI 요약 콘텐츠 영역 생성
    const summaryContentDiv = document.createElement('div');
    summaryContentDiv.id = SUMMARY_CONTENT_ID;
    summaryContentDiv.classList.add('yt-ai-summary-content');
    summaryContentDiv.style.display = 'none'; // 기본적으로 숨김

    // 댓글 요약 콘텐츠 영역 생성
    const commentsContentDiv = document.createElement('div');
    commentsContentDiv.id = COMMENTS_CONTENT_ID;
    commentsContentDiv.classList.add('yt-comments-summary-content');
    commentsContentDiv.style.display = 'none'; // 기본적으로 숨김

    // 로딩, 에러, 텍스트 요소들 (새로고침 버튼은 이제 탭바에 있으므로 제거)
    const loadingMessage = document.createElement('p');
    loadingMessage.id = 'ai-summary-loading';
    loadingMessage.textContent = '요약 정보를 불러오는 중...';
    loadingMessage.style.display = 'none';

    const errorMessage = document.createElement('p');
    errorMessage.id = 'ai-summary-error';
    errorMessage.style.color = 'red';
    errorMessage.style.display = 'none';

    const summaryTextElement = document.createElement('div');
    summaryTextElement.id = 'ai-summary-text';

    // AI 요약 내용 구성 (새로고침 버튼 제거)
    summaryContentDiv.appendChild(loadingMessage);
    summaryContentDiv.appendChild(errorMessage);
    summaryContentDiv.appendChild(summaryTextElement);

    // 댓글 요약용 로딩, 에러, 텍스트 요소들 생성
    const commentsLoadingMessage = document.createElement('p');
    commentsLoadingMessage.id = 'comments-summary-loading';
    commentsLoadingMessage.textContent = '댓글을 수집하고 있습니다...';
    commentsLoadingMessage.style.display = 'none';

    const commentsErrorMessage = document.createElement('p');
    commentsErrorMessage.id = 'comments-summary-error';
    commentsErrorMessage.style.color = 'red';
    commentsErrorMessage.style.display = 'none';

    const commentsTextElement = document.createElement('div');
    commentsTextElement.id = 'comments-summary-text';

    // 댓글 요약 내용 구성
    commentsContentDiv.appendChild(commentsLoadingMessage);
    commentsContentDiv.appendChild(commentsErrorMessage);
    commentsContentDiv.appendChild(commentsTextElement);

    // 5. 전체 UI 컨테이너 생성
    const uiContainer = document.createElement('div');
    uiContainer.id = UI_CONTAINER_ID;
    uiContainer.classList.add('yt-ai-summary-container');
    uiContainer.appendChild(tabsContainer);
    uiContainer.appendChild(summaryContentDiv);
    uiContainer.appendChild(commentsContentDiv);

    // 6. 스크립트 패널 내부에 UI 삽입 (기존 스크립트 내용 위에)
    ytTranscriptContentElement.insertBefore(uiContainer, ytTranscriptContentElement.firstChild);
    console.log('[AI 요약] UI가 스크립트 패널 내부에 성공적으로 삽입되었습니다.');

    // 7. 탭 전환 이벤트 리스너 등록
    scriptTabButton.addEventListener('click', () => switchTab(SCRIPT_TAB_ID));
    summaryTabButton.addEventListener('click', () => switchTab(SUMMARY_TAB_ID));
    commentsTabButton.addEventListener('click', () => switchTab(COMMENTS_TAB_ID));

    // 8. 이벤트 리스너 추가
    refreshButton.addEventListener('click', handleRefreshSummary);
    copyButton.addEventListener('click', handleCopyToClipboard);

    // 9. 초기 상태: 스크립트 탭 활성화
    switchTab(SCRIPT_TAB_ID);
}

/**
 * YouTube 스크립트 패널 또는 적절한 UI 삽입 위치를 찾습니다. (이 함수는 이제 사용 빈도가 줄어들 수 있음)
 * 대신 ytd-transcript-renderer를 직접 찾고, 그 내부에서 UI 위치를 결정.
 * @returns {HTMLElement|null} UI를 삽입할 부모 요소 (이제는 ytd-transcript-renderer 자체가 기준)
 */
function findTargetPanel() { // 이 함수의 역할이 변경됨
    return document.querySelector('ytd-transcript-renderer');
}


/**
 * 탭을 전환합니다.
 * @param {string} tabIdToActivate 활성화할 탭의 ID
 */
function switchTab(tabIdToActivate) {
    const scriptTabBtn = document.getElementById(SCRIPT_TAB_ID);
    const summaryTabBtn = document.getElementById(SUMMARY_TAB_ID);
    const summaryContent = document.getElementById(SUMMARY_CONTENT_ID);
    const commentsTabBtn = document.getElementById(COMMENTS_TAB_ID);
    const commentsContent = document.getElementById(COMMENTS_CONTENT_ID);

    // UI 요소들이 존재하지 않으면 다시 생성 시도
    if (!scriptTabBtn || !summaryTabBtn || !summaryContent || !commentsTabBtn || !commentsContent) {
        console.warn('[AI 요약] 탭 또는 AI 요약 내용 영역을 찾을 수 없습니다. UI 복구 시도.');

        const transcriptRenderer = document.querySelector('ytd-transcript-renderer');
        if (transcriptRenderer && window.location.href.includes('/watch?v=')) {
            // 기존 UI가 있다면 제거하고 새로 생성
            removeUI();
            initializeExtension(transcriptRenderer);

            // 복구 후 다시 요소들 찾기
            const newScriptTabBtn = document.getElementById(SCRIPT_TAB_ID);
            const newSummaryTabBtn = document.getElementById(SUMMARY_TAB_ID);
            const newSummaryContent = document.getElementById(SUMMARY_CONTENT_ID);
            const newCommentsTabBtn = document.getElementById(COMMENTS_TAB_ID);
            const newCommentsContent = document.getElementById(COMMENTS_CONTENT_ID);

            if (!newScriptTabBtn || !newSummaryTabBtn || !newSummaryContent || !newCommentsTabBtn || !newCommentsContent) {
                console.error('[AI 요약] UI 복구 후에도 탭 요소들을 찾을 수 없습니다.');
                return;
            }

            // 복구된 요소들로 다시 탭 전환 시도
            switchTabInternal(tabIdToActivate, newScriptTabBtn, newSummaryTabBtn, newSummaryContent, newCommentsTabBtn, newCommentsContent);
        } else {
            console.error('[AI 요약] 스크립트 패널을 찾을 수 없어 UI를 복구할 수 없습니다.');
        }
        return;
    }

    switchTabInternal(tabIdToActivate, scriptTabBtn, summaryTabBtn, summaryContent, commentsTabBtn, commentsContent);
}

/**
 * 실제 탭 전환 로직을 수행합니다.
 * @param {string} tabIdToActivate 활성화할 탭의 ID
 * @param {HTMLElement} scriptTabBtn 스크립트 탭 버튼
 * @param {HTMLElement} summaryTabBtn AI 요약 탭 버튼
 * @param {HTMLElement} summaryContent AI 요약 콘텐츠 영역
 */
function switchTabInternal(tabIdToActivate, scriptTabBtn, summaryTabBtn, summaryContent, commentsTabBtn, commentsContent) {
    // 탭 전환 후 버튼 스타일 강제 재적용 함수
    function enforceButtonStyles() {
        const copyButton = document.getElementById('ai-summary-copy-button');
        const refreshButton = document.getElementById(REFRESH_BUTTON_ID);

        if (copyButton) {
            copyButton.style.cssText = `
                background: none !important;
                border: none !important;
                cursor: ${copyButton.disabled ? 'not-allowed' : 'pointer'} !important;
                padding: 8px !important;
                border-radius: 4px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 32px !important;
                height: 32px !important;
                min-width: 32px !important;
                min-height: 32px !important;
                max-width: 32px !important;
                max-height: 32px !important;
                visibility: visible !important;
                opacity: ${copyButton.disabled ? '0.5' : '1'} !important;
                position: relative !important;
                overflow: visible !important;
                box-sizing: border-box !important;
                color: var(--yt-spec-text-secondary) !important;
                transition: all 0.2s ease !important;
                margin: 0 !important;
                outline: none !important;
                transform: none !important;
                filter: none !important;
                flex-shrink: 0 !important;
                flex-grow: 0 !important;
                flex-basis: auto !important;
            `;

            // SVG 스타일도 재적용
            const copySvg = copyButton.querySelector('svg');
            if (copySvg) {
                copySvg.style.cssText = `
                    width: 16px !important;
                    height: 16px !important;
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    pointer-events: none !important;
                    stroke: currentColor !important;
                    fill: none !important;
                    transform: none !important;
                    filter: none !important;
                `;
            }
        }

        if (refreshButton) {
            refreshButton.style.cssText = `
                background: none !important;
                border: none !important;
                cursor: pointer !important;
                padding: 8px !important;
                border-radius: 4px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 32px !important;
                height: 32px !important;
                min-width: 32px !important;
                min-height: 32px !important;
                max-width: 32px !important;
                max-height: 32px !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: relative !important;
                overflow: visible !important;
                box-sizing: border-box !important;
                color: var(--yt-spec-text-secondary) !important;
                transition: all 0.2s ease !important;
                margin: 0 !important;
                outline: none !important;
                transform: none !important;
                filter: none !important;
                flex-shrink: 0 !important;
                flex-grow: 0 !important;
                flex-basis: auto !important;
            `;

            // SVG 스타일도 재적용
            const refreshSvg = refreshButton.querySelector('svg');
            if (refreshSvg) {
                refreshSvg.style.cssText = `
                    width: 16px !important;
                    height: 16px !important;
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    pointer-events: none !important;
                    stroke: currentColor !important;
                    fill: none !important;
                    transform: none !important;
                    filter: none !important;
                `;
            }
        }
    }

    if (tabIdToActivate === SCRIPT_TAB_ID) {
        // 스크립트 탭 활성화
        scriptTabBtn.classList.add('active');
        summaryTabBtn.classList.remove('active');
        summaryContent.style.display = 'none';
        commentsTabBtn.classList.remove('active');
        commentsContent.style.display = 'none';

        // YouTube 자체 스크립트 내용 표시
        if (ytTranscriptSegmentsContainer) {
            ytTranscriptSegmentsContainer.style.display = '';
        }
        // 전체 스크립트 리스트도 표시
        const transcriptSegmentList = ytTranscriptRendererElement?.querySelector('ytd-transcript-segment-list-renderer');
        if (transcriptSegmentList) {
            transcriptSegmentList.style.display = '';
        }

        // 스크립트 검색 패널도 다시 표시
        const transcriptSearchPanel = ytTranscriptRendererElement?.querySelector('ytd-transcript-search-panel-renderer');
        if (transcriptSearchPanel) {
            transcriptSearchPanel.style.display = '';
        }

    } else if (tabIdToActivate === SUMMARY_TAB_ID) {
        // AI 요약 탭 활성화
        scriptTabBtn.classList.remove('active');
        summaryTabBtn.classList.add('active');
        summaryContent.style.display = 'block';
        commentsTabBtn.classList.remove('active');
        commentsContent.style.display = 'none';

        // YouTube 자체 스크립트 내용 숨김
        if (ytTranscriptSegmentsContainer) {
            ytTranscriptSegmentsContainer.style.display = 'none';
        }
        // 전체 스크립트 리스트도 숨김
        const transcriptSegmentList = ytTranscriptRendererElement?.querySelector('ytd-transcript-segment-list-renderer');
        if (transcriptSegmentList) {
            transcriptSegmentList.style.display = 'none';
        }

        // 스크립트 검색 패널도 숨김
        const transcriptSearchPanel = ytTranscriptRendererElement?.querySelector('ytd-transcript-search-panel-renderer');
        if (transcriptSearchPanel) {
            transcriptSearchPanel.style.display = 'none';
        }

        // AI 요약 로드 (아직 로드되지 않았다면)
        loadAndDisplaySummary();
    } else if (tabIdToActivate === COMMENTS_TAB_ID) {
        // 댓글 요약 탭 활성화
        scriptTabBtn.classList.remove('active');
        summaryTabBtn.classList.remove('active');
        summaryContent.style.display = 'none';
        commentsTabBtn.classList.add('active');
        commentsContent.style.display = 'block';

        // 댓글 수집 로직 실행
        collectComments();
    }

    // 탭 전환 후 버튼 스타일 강제 재적용 (약간의 지연 후)
    setTimeout(enforceButtonStyles, 50);
    setTimeout(enforceButtonStyles, 200); // 추가 보장
}

// --- 스크립트 추출 로직 ---

/**
 * 현재 YouTube 동영상의 스크립트(자막) 텍스트를 추출합니다.
 * @returns {string|null} 추출된 스크립트 텍스트 또는 실패 시 null
 */
function extractTranscriptText() {
    console.log('[AI 요약] 스크립트 추출 시도...');

    // ytTranscriptSegmentsContainer는 injectUI에서 이미 식별됨
    if (!ytTranscriptSegmentsContainer) {
        console.warn('[AI 요약] 스크립트 세그먼트 컨테이너를 찾을 수 없습니다 (추출).');
        console.log('[AI 요약] 디버깅: ytTranscriptRendererElement:', ytTranscriptRendererElement);
        console.log('[AI 요약] 디버깅: ytTranscriptContentElement:', ytTranscriptContentElement);

        // 스크립트 패널을 열도록 유도하거나, 사용자에게 알림
        const openTranscriptButton = document.querySelector(
            'button[aria-label*="transcript"], button[aria-label*="스크립트"]' // "Show transcript", "스크립트 표시" 등
        );
        if (openTranscriptButton && !isTranscriptPanelOpen()) {
            showErrorMessage('스크립트 패널이 닫혀 있습니다. 스크립트를 열고 다시 시도해주세요.');
        } else {
            showErrorMessage('스크립트 내용을 찾을 수 없습니다. 스크립트가 제공되는 동영상인지 확인해주세요.');
        }
        return null;
    }

    console.log('[AI 요약] 디버깅: 스크립트 세그먼트 컨테이너 발견:', ytTranscriptSegmentsContainer);

    // Tampermonkey 참고: ytd-transcript-segment-renderer 내부의 .segment-text (yt-formatted-string)
    const transcriptSegments = ytTranscriptSegmentsContainer.querySelectorAll(
        'ytd-transcript-segment-renderer .segment-text, ytd-transcript-segment-renderer .yt-formatted-string' // 더 많은 케이스 포괄
    );

    console.log(`[AI 요약] 디버깅: 발견된 스크립트 세그먼트 수: ${transcriptSegments.length}`);

    if (!transcriptSegments || transcriptSegments.length === 0) {
        console.warn('[AI 요약] 스크립트 세그먼트 요소를 찾을 수 없습니다.');

        // 대안적인 선택자들 시도
        const alternativeSegments = ytTranscriptSegmentsContainer.querySelectorAll(
            'yt-formatted-string, [class*="segment"], [class*="transcript"]'
        );
        console.log(`[AI 요약] 디버깅: 대안 선택자로 발견된 요소 수: ${alternativeSegments.length}`);

        if (alternativeSegments.length > 0) {
            console.log('[AI 요약] 디버깅: 대안 요소들 샘플:', Array.from(alternativeSegments).slice(0, 3).map(el => ({
                tagName: el.tagName,
                className: el.className,
                textContent: el.textContent?.substring(0, 50)
            })));
        }

        showErrorMessage('추출할 스크립트 내용이 없습니다.');
        return null;
    }

    let fullTranscript = "";
    transcriptSegments.forEach((segment, index) => {
        if (segment && segment.textContent) {
            const text = segment.textContent.trim();
            if (text) {
                fullTranscript += text + "\n"; // 각 줄을 새 줄로 구분
                // 처음 3개 세그먼트만 디버깅 로그 출력
                if (index < 3) {
                    console.log(`[AI 요약] 디버깅: 세그먼트 ${index + 1}: "${text.substring(0, 50)}..."`);
                }
            }
        }
    });

    if (fullTranscript.trim() === "") {
        console.warn('[AI 요약] 스크립트 내용은 추출되었으나 비어있습니다.');
        showErrorMessage('스크립트 내용이 비어있습니다.');
        return null;
    }

    const finalTranscript = fullTranscript.trim();
    console.log(`[AI 요약] 스크립트 추출 완료 - 총 길이: ${finalTranscript.length}자`);
    console.log(`[AI 요약] 스크립트 미리보기 (처음 200자): ${finalTranscript.substring(0, 200)}...`);

    hideErrorMessage();
    return finalTranscript;
}

/**
 * 스크립트 패널이 열려있는지 확인합니다.
 * @returns {boolean} 스크립트 패널이 열려있으면 true
 */
function isTranscriptPanelOpen() {
    // 스크립트 패널이 열려있으면 ytd-transcript-renderer가 존재하고 visible 상태
    const transcriptRenderer = document.querySelector('ytd-transcript-renderer');
    if (!transcriptRenderer) {
        console.log('[AI 요약] 디버깅: 스크립트 렌더러가 존재하지 않음');
        return false;
    }

    // 스타일이나 속성으로 숨겨져 있는지 확인
    const style = window.getComputedStyle(transcriptRenderer);
    const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';

    console.log('[AI 요약] 디버깅: 스크립트 패널 상태 - 존재:', !!transcriptRenderer, '보임:', isVisible);

    return isVisible;
}


// --- (fetchAndDisplaySummary, handleRefreshSummary, loadAndDisplaySummary 등 나머지 함수들은 이전과 거의 동일) ---
// ... (이전 코드 내용) ...
// 단, getSettingsFromStorage, storeSummary, getStoredSummary 등은 그대로 유지됩니다.

/**
 * 새로운 비디오로 변경되었을 때 UI를 업데이트합니다.
 * (예: 이전 요약 지우기, 새 요약 로드)
 */
function updateUIForNewVideo() {
    const newVideoId = getCurrentVideoId();

    if (newVideoId && newVideoId !== currentVideoId) {
        console.log(`[AI 요약] 새 비디오 감지: ${currentVideoId} → ${newVideoId}`);
        currentVideoId = newVideoId;

        // 기존 요약 내용 초기화
        currentSummaryText = '';
        currentCommentsSummaryText = '';

        // 댓글 수집 데이터 초기화
        collectedComments = [];
        commentCollectionProgress = { current: 0, total: 100 };
        isCollectingComments = false;

        // 로딩 타이머 정리
        if (loadingTimer) {
            clearInterval(loadingTimer);
            loadingTimer = null;
        }
        loadingStartTime = null;

        if (commentsLoadingTimer) {
            clearInterval(commentsLoadingTimer);
            commentsLoadingTimer = null;
        }
        commentsLoadingStartTime = null;

        const summaryContent = document.getElementById(SUMMARY_CONTENT_ID);
        const commentsContent = document.getElementById(COMMENTS_CONTENT_ID);

        if (summaryContent) {
            summaryContent.innerHTML = '';
        }

        if (commentsContent) {
            const commentsTextElement = document.getElementById('comments-summary-text');
            const commentsLoadingElement = document.getElementById('comments-summary-loading');
            const commentsErrorElement = document.getElementById('comments-summary-error');

            if (commentsTextElement) {
                commentsTextElement.innerHTML = '';
            }
            if (commentsLoadingElement) {
                commentsLoadingElement.style.display = 'none';
            }
            if (commentsErrorElement) {
                commentsErrorElement.style.display = 'none';
            }
        }

        // 복사 버튼 비활성화
        const copyButton = document.getElementById('ai-summary-copy-button');
        if (copyButton) {
            copyButton.disabled = true;
            copyButton.style.opacity = '0.5';
            copyButton.title = '요약 내용 복사';
        }

        // 스크립트 탭으로 전환
        switchTab(SCRIPT_TAB_ID);
    }
}


// --- 페이지 변경 감지 및 초기화 로직 ---
// observePageChanges, initializeExtension 등 수정

let pageObserver = null; // MutationObserver 인스턴스 저장

/**
 * YouTube의 SPA 특성으로 인한 페이지 변경(네비게이션)을 감지하고,
 * 필요시 UI를 재삽입하거나 업데이트합니다.
 */
function observePageChanges() {
    // YouTube 도메인이 아니면 감시하지 않음
    if (!window.location.hostname.includes('youtube.com')) {
        console.log('[AI 요약] YouTube가 아닌 도메인에서는 페이지 감시를 시작하지 않습니다.');
        return;
    }

    // yt-navigate-finish 이벤트가 더 안정적일 수 있음
    document.addEventListener('yt-navigate-finish', handleNavigation);

    // 페이지 포커스/visibility 변경 시에도 UI 상태 체크
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            setTimeout(checkAndRestoreUIFromMain, 1000);
        }
    });

    window.addEventListener('focus', () => {
        setTimeout(checkAndRestoreUIFromMain, 1000);
    });

    // MutationObserver는 스크립트 패널이 동적으로 로드되는 경우를 대비
    if (pageObserver) pageObserver.disconnect(); // 기존 옵저버 정리

    pageObserver = new MutationObserver((mutationsList, observer) => {
        let shouldCheckUI = false;

        for (const mutation of mutationsList) {
            // ytd-transcript-renderer가 나타났는지 확인
            const transcriptRenderer = document.querySelector('ytd-transcript-renderer');

            if (transcriptRenderer && !document.getElementById(UI_CONTAINER_ID)) {
                console.log('[AI 요약] MutationObserver: ytd-transcript-renderer 감지. UI 초기화 시도.');
                initializeExtension(transcriptRenderer);
                return;
            } else if (!transcriptRenderer && document.getElementById(UI_CONTAINER_ID)) {
                // 스크립트 패널이 사라졌는데 우리 UI가 남아있는 경우
                console.log('[AI 요약] MutationObserver: ytd-transcript-renderer 사라짐. UI 제거 시도.');
                removeUI();
                return;
            }

            // 스크립트 패널 내부 변경사항 감지
            if (mutation.type === 'childList') {
                const target = mutation.target;

                // 스크립트 패널 관련 요소들의 변경 감지
                if (target.matches && (
                    target.matches('ytd-transcript-renderer') ||
                    target.matches('ytd-transcript-renderer *') ||
                    target.matches('#content.ytd-transcript-renderer') ||
                    target.matches('#content.ytd-transcript-renderer *')
                )) {
                    shouldCheckUI = true;
                }

                // 추가된 노드들 중에 스크립트 관련 요소가 있는지 확인
                for (const addedNode of mutation.addedNodes) {
                    if (addedNode.nodeType === Node.ELEMENT_NODE) {
                        if (addedNode.matches && (
                            addedNode.matches('ytd-transcript-renderer') ||
                            addedNode.matches('ytd-transcript-segment-list-renderer') ||
                            addedNode.querySelector && addedNode.querySelector('ytd-transcript-renderer')
                        )) {
                            shouldCheckUI = true;
                            break;
                        }
                    }
                }

                // 제거된 노드들 중에 우리 UI가 있는지 확인
                for (const removedNode of mutation.removedNodes) {
                    if (removedNode.nodeType === Node.ELEMENT_NODE) {
                        if (removedNode.id === UI_CONTAINER_ID ||
                            (removedNode.querySelector && removedNode.querySelector(`#${UI_CONTAINER_ID}`))) {
                            console.log('[AI 요약] MutationObserver: UI 제거 감지');
                            shouldCheckUI = true;
                            break;
                        }
                    }
                }
            }
        }

        if (shouldCheckUI) {
            // 즉시 체크하지 말고 약간의 지연 후 체크 (DOM 변경이 완료된 후)
            setTimeout(() => {
                const transcriptRenderer = document.querySelector('ytd-transcript-renderer');
                if (transcriptRenderer) {
                    checkAndRestoreUI(transcriptRenderer);
                }
            }, 500);
        }
    });

    pageObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: false,
        attributeOldValue: false,
        characterData: false,
        characterDataOldValue: false
    });
    console.log('[AI 요약] 페이지 변경 감시 시작 (MutationObserver for ytd-transcript-renderer).');

    // 초기 페이지 로드 시도
    const initialTranscriptRenderer = document.querySelector('ytd-transcript-renderer');
    if (initialTranscriptRenderer) {
        initializeExtension(initialTranscriptRenderer);
    }
}

/**
 * 메인 스레드에서 UI 상태를 체크하고 복구합니다.
 */
function checkAndRestoreUIFromMain() {
    if (!window.location.href.includes('/watch?v=')) {
        return;
    }

    const transcriptRenderer = document.querySelector('ytd-transcript-renderer');
    if (transcriptRenderer) {
        checkAndRestoreUI(transcriptRenderer);
    }
}

function handleNavigation(event) {
    console.log('[AI 요약] yt-navigate-finish 이벤트 감지:', event.detail?.pageType, event.detail?.url);

    // 이전 UI가 있다면 정리 (필수)
    removeUI(); // UI와 참조 변수들 초기화

    const isWatchPage = event.detail?.pageType === 'watch' || (event.detail?.url && event.detail.url.includes('/watch?v='));
    const isShortsPage = event.detail?.pageType === 'shorts' || (event.detail?.url && event.detail.url.includes('/shorts/')); // Shorts는 스크립트가 거의 없음

    if (isWatchPage) { // Shorts 페이지는 스크립트가 일반적이지 않으므로 일단 Watch 페이지만 대상
        console.log('[AI 요약] 동영상 시청 페이지로 이동 감지.');
        currentVideoId = getVideoIdFromUrl(event.detail?.url); // currentVideoId 업데이트

        // ytd-transcript-renderer가 나타날 때까지 기다리거나,
        // MutationObserver가 이를 감지하고 initializeExtension을 호출하도록 함.
        // 혹은 약간의 지연 후 직접 시도
        setTimeout(() => {
            const transcriptRenderer = document.querySelector('ytd-transcript-renderer');
            if (transcriptRenderer) {
                initializeExtension(transcriptRenderer);
            } else {
                console.log('[AI 요약] 네비게이션 후 ytd-transcript-renderer를 즉시 찾지 못함. MutationObserver가 처리할 수 있음.');
            }
        }, 500); // YouTube가 DOM을 완전히 업데이트할 시간을 줌
    } else {
        console.log('[AI 요약] 동영상 시청 페이지가 아님.');
    }
}

/**
 * 확장 기능의 주요 로직을 시작합니다.
 * @param {HTMLElement} transcriptRenderer - ytd-transcript-renderer 요소
 */
function initializeExtension(transcriptRenderer) {
    // YouTube 도메인이 아니면 초기화하지 않음
    if (!window.location.hostname.includes('youtube.com')) {
        console.log('[AI 요약] YouTube가 아닌 도메인에서는 확장프로그램을 초기화하지 않습니다.');
        return;
    }

    if (!transcriptRenderer) {
        console.log('[AI 요약] ytd-transcript-renderer가 없어 초기화 실패.');
        return;
    }
    // 현재 비디오 ID 가져오기 및 업데이트
    currentVideoId = getCurrentVideoId(); // 현재 URL 기준
    if (!currentVideoId && window.location.href.includes('/watch?v=')) {
        // yt-navigate-finish에서 이미 설정했거나, 여기서 다시 가져옴
        currentVideoId = getVideoIdFromUrl(window.location.href);
    }

    if (!currentVideoId) {
        console.log('[AI 요약] 현재 동영상 ID를 가져올 수 없어 초기화 건너뜁니다.');
        return;
    }
    console.log(`[AI 요약] 확장 기능 초기화 시작 (Video ID: ${currentVideoId})`);
    injectUI(transcriptRenderer);

    // 주기적 UI 상태 체크 시작
    startUIHealthCheck();

    // YouTube 탭 전환 감지를 위한 추가 이벤트 설정
    setupTabChangeDetection();
}

/**
 * YouTube 탭 전환 감지를 위한 이벤트 설정
 */
function setupTabChangeDetection() {
    // 기존 이벤트 리스너가 있다면 제거
    if (tabChangeClickListener) {
        document.removeEventListener('click', tabChangeClickListener, true);
    }
    if (tabChangeKeyListener) {
        document.removeEventListener('keydown', tabChangeKeyListener);
    }

    // YouTube의 탭 전환은 주로 클릭 이벤트로 발생
    tabChangeClickListener = (event) => {
        const target = event.target;

        // YouTube 탭 버튼 클릭 감지
        if (target && (
            target.matches('tp-yt-paper-tab') ||
            target.matches('tp-yt-paper-tab *') ||
            target.matches('[role="tab"]') ||
            target.matches('[role="tab"] *') ||
            target.closest('tp-yt-paper-tab') ||
            target.closest('[role="tab"]')
        )) {
            // 탭 전환 후 UI 상태 체크
            setTimeout(() => {
                checkAndRestoreUIFromMain();
            }, 2000);

            // 추가로 약간 더 지연 후에도 체크 (DOM 변경이 완전히 끝난 후)
            setTimeout(() => {
                checkAndRestoreUIFromMain();
            }, 5000);
        }

        // 스크립트 버튼 클릭 감지
        if (target && (
            target.matches('button[aria-label*="transcript"]') ||
            target.matches('button[aria-label*="스크립트"]') ||
            target.matches('button[aria-label*="Show transcript"]') ||
            target.closest('button[aria-label*="transcript"]') ||
            target.closest('button[aria-label*="스크립트"]') ||
            target.closest('button[aria-label*="Show transcript"]')
        )) {
            // 스크립트 패널 열기/닫기 후 UI 상태 체크
            setTimeout(() => {
                const transcriptRenderer = document.querySelector('ytd-transcript-renderer');
                if (transcriptRenderer) {
                    checkAndRestoreUI(transcriptRenderer);
                }
            }, 3000);
        }
    };

    document.addEventListener('click', tabChangeClickListener, true); // capture phase에서 이벤트 감지

    // 키보드 네비게이션도 감지
    tabChangeKeyListener = (event) => {
        // Tab, Enter, Space 키 등으로 탭 전환 시
        if (['Tab', 'Enter', ' ', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            const activeElement = document.activeElement;
            if (activeElement && (
                activeElement.matches('tp-yt-paper-tab') ||
                activeElement.matches('[role="tab"]') ||
                activeElement.closest('tp-yt-paper-tab') ||
                activeElement.closest('[role="tab"]')
            )) {
                setTimeout(() => {
                    checkAndRestoreUIFromMain();
                }, 2000);
            }
        }
    };

    document.addEventListener('keydown', tabChangeKeyListener);
}

/**
 * UI 요소들을 페이지에서 제거하고 관련 변수를 초기화합니다.
 */
function removeUI() {
    const ui = document.getElementById(UI_CONTAINER_ID);
    if (ui) {
        ui.remove();
        console.log('[AI 요약] 기존 UI 제거됨.');
    }

    // 주기적 체크 인터벌 정리
    if (uiCheckInterval) {
        clearInterval(uiCheckInterval);
        uiCheckInterval = null;
        console.log('[AI 요약] UI 상태 체크 인터벌 정리됨.');
    }

    // 이벤트 리스너 정리
    if (tabChangeClickListener) {
        document.removeEventListener('click', tabChangeClickListener, true);
        tabChangeClickListener = null;
    }
    if (tabChangeKeyListener) {
        document.removeEventListener('keydown', tabChangeKeyListener);
        tabChangeKeyListener = null;
    }

    // 관련 전역 DOM 참조 초기화
    ytTranscriptRendererElement = null;
    ytTranscriptContentElement = null;
    ytTranscriptSegmentsContainer = null;
    // currentVideoId는 네비게이션 시 새로 설정되므로 여기서 null로 만들 필요는 없음
}

/**
 * 주기적으로 UI 상태를 체크하고 필요시 복구합니다.
 */
function startUIHealthCheck() {
    // 기존 인터벌이 있다면 정리
    if (uiCheckInterval) {
        clearInterval(uiCheckInterval);
    }

    uiCheckInterval = setInterval(() => {
        // 동영상 페이지가 아니면 체크 중단
        if (!window.location.href.includes('/watch?v=')) {
            return;
        }

        const transcriptRenderer = document.querySelector('ytd-transcript-renderer');
        const uiContainer = document.getElementById(UI_CONTAINER_ID);

        // 스크립트 패널은 있는데 우리 UI가 없으면 복구
        if (transcriptRenderer && !uiContainer) {
            console.log('[AI 요약] 주기적 체크: UI가 제거된 상태 감지. 복구 시도.');
            const transcriptContent = transcriptRenderer.querySelector('div#content.ytd-transcript-renderer');
            if (transcriptContent) {
                const newVideoId = getCurrentVideoId();
                if (newVideoId) {
                    currentVideoId = newVideoId;
                    initializeExtension(transcriptRenderer);
                }
            }
        } else if (uiContainer && transcriptRenderer) {
            // UI는 있지만 올바른 위치에 있지 않을 수 있음 - 부모 확인
            const uiParent = uiContainer.parentElement;
            if (!uiParent || !transcriptRenderer.contains(uiContainer)) {
                console.log('[AI 요약] UI가 잘못된 위치에 있음. 재배치 시도.');

                // 기존 UI 제거 후 재삽입
                uiContainer.remove();

                const newVideoId = getCurrentVideoId();
                if (newVideoId) {
                    currentVideoId = newVideoId;
                    initializeExtension(transcriptRenderer);
                }
            }
        }
    }, 500); // 0.5초마다 체크 (더 빠른 복구)
}


// --- (나머지 함수: getSettingsFromStorage, storeSummary, getStoredSummary, getCurrentVideoId, showErrorMessage, hideErrorMessage 등은 이전과 유사하게 사용) ---
// ... 이전 코드 내용 ...
// 단, getSettingsFromStorage, storeSummary, getStoredSummary 등은 그대로 유지됩니다.


// --- 실행 ---
// DOMContentLoaded는 초기 로드에만 유용. SPA 환경에서는 observePageChanges가 핵심.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observePageChanges);
} else {
    observePageChanges();
}

console.log('[AI 요약] YouTube AI 요약 content_script 로드됨 (v2 - UI 위치 수정).');

// --- AI 요약 관련 함수들 ---

/**
 * 요약을 로드하고 표시합니다. (저장된 요약이 있으면 사용, 없으면 새로 생성)
 */
async function loadAndDisplaySummary() {
    console.log('[AI 요약] 요약 로드 시작');

    if (!currentVideoId) {
        showErrorMessage('비디오 ID를 가져올 수 없습니다.');
        return;
    }

    // 1. 저장된 요약이 있는지 확인
    const storedSummary = await getStoredSummary(currentVideoId);
    if (storedSummary) {
        console.log('[AI 요약] 저장된 요약 발견, 표시 중...');
        displaySummary(storedSummary);
        return;
    }

    // 2. 저장된 요약이 없으면 새로 생성
    console.log('[AI 요약] 저장된 요약이 없어 새로 생성 중...');
    await fetchAndDisplaySummary();
}

/**
 * 새로고침 버튼 클릭 시 실행되는 함수
 */
async function handleRefreshSummary() {
    // 현재 활성화된 탭 확인
    const summaryTab = document.getElementById(SUMMARY_TAB_ID);
    const commentsTab = document.getElementById(COMMENTS_TAB_ID);

    if (commentsTab && commentsTab.classList.contains('active')) {
        // 댓글 요약 탭이 활성화된 경우
        await handleRefreshCommentsSummary();
    } else {
        // AI 요약 탭이 활성화된 경우 (기본값)
        await handleRefreshAISummary();
    }
}

/**
 * AI 요약 새로고침 버튼 클릭 시 실행되는 함수
 */
async function handleRefreshAISummary() {
    console.log('[AI 요약] 요약 새로고침 요청');

    // 복사 버튼 비활성화 및 원본 텍스트 초기화
    const copyButton = document.getElementById('ai-summary-copy-button');
    if (copyButton) {
        copyButton.disabled = true;
        copyButton.style.opacity = '0.5';
    }
    currentSummaryText = '';

    await fetchAndDisplaySummary();
}

/**
 * 댓글 요약 새로고침 버튼 클릭 시 실행되는 함수
 */
async function handleRefreshCommentsSummary() {
    console.log('[댓글 요약] 댓글 요약 새로고침 요청');

    // 복사 버튼 비활성화 및 원본 텍스트 초기화
    const copyButton = document.getElementById('ai-summary-copy-button');
    if (copyButton) {
        copyButton.disabled = true;
        copyButton.style.opacity = '0.5';
    }
    currentCommentsSummaryText = '';

    await fetchAndDisplayCommentsCollection();
}

/**
 * 클립보드 복사 버튼 클릭 이벤트를 처리합니다.
 */
async function handleCopyToClipboard() {
    const copyButton = document.getElementById('ai-summary-copy-button');
    if (!copyButton) return;

    try {
        // 현재 활성화된 탭 확인
        const summaryTab = document.getElementById(SUMMARY_TAB_ID);
        const commentsTab = document.getElementById(COMMENTS_TAB_ID);

        let textToCopy = '';
        let feedbackMessage = '';

        if (summaryTab && summaryTab.classList.contains('active')) {
            // AI 요약 탭이 활성화된 경우
            textToCopy = currentSummaryText;
            feedbackMessage = 'AI 요약이 클립보드에 복사되었습니다!';
        } else if (commentsTab && commentsTab.classList.contains('active')) {
            // 댓글 요약 탭이 활성화된 경우
            textToCopy = currentCommentsSummaryText;
            feedbackMessage = '댓글 요약이 클립보드에 복사되었습니다!';
        } else {
            // 기본적으로 AI 요약 복사
            textToCopy = currentSummaryText;
            feedbackMessage = 'AI 요약이 클립보드에 복사되었습니다!';
        }

        if (!textToCopy) {
            showCopyFeedback(copyButton, false);
            return;
        }

        const success = await copyToClipboard(textToCopy);
        showCopyFeedback(copyButton, success, feedbackMessage);
    } catch (error) {
        console.error('[AI 요약] 클립보드 복사 오류:', error);
        showCopyFeedback(copyButton, false);
    }
}

/**
 * 클립보드에 텍스트를 복사합니다.
 * @param {string} text - 복사할 텍스트
 * @returns {Promise<boolean>} 복사 성공 여부
 */
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            // 최신 Clipboard API 사용 (HTTPS 환경)
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback: execCommand 방식 (HTTP/오래된 브라우저)
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            textArea.style.opacity = '0';
            textArea.style.pointerEvents = 'none';

            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);

            if (!successful) {
                throw new Error('execCommand 복사 실패');
            }
        }
        return true;
    } catch (error) {
        console.error('[AI 요약] 클립보드 복사 실패:', error);
        return false;
    }
}

/**
 * 복사 버튼에 성공/실패 피드백을 표시합니다.
 * @param {HTMLElement} button - 복사 버튼 요소
 * @param {boolean} success - 복사 성공 여부
 */
function showCopyFeedback(button, success, message = null) {
    if (!button) return;

    const originalTitle = button.title;
    const feedbackMessage = message || (success ? '복사 완료!' : '복사 실패');

    // 버튼 스타일 변경
    if (success) {
        button.style.color = '#4caf50';
        button.title = feedbackMessage;
    } else {
        button.style.color = '#f44336';
        button.title = feedbackMessage;
    }

    // 2초 후 원래 상태로 복구
    setTimeout(() => {
        button.style.color = 'var(--yt-spec-text-secondary)';
        button.title = originalTitle;
    }, 2000);
}

/**
 * 요약 내용을 화면에 표시합니다.
 */
function displaySummary(summary) {
    const summaryTextElement = document.getElementById('ai-summary-text');
    if (summaryTextElement) {
        // 원본 마크다운 텍스트 저장 (복사용)
        currentSummaryText = summary;

        // 마크다운 스타일 주입
        injectMarkdownStyles();

        // 마크다운을 HTML로 변환하여 표시
        const htmlContent = parseMarkdownToHTML(summary);
        summaryTextElement.innerHTML = htmlContent;

        // 복사 버튼 활성화
        const copyButton = document.getElementById('ai-summary-copy-button');
        if (copyButton) {
            copyButton.disabled = false;
            copyButton.style.opacity = '1';
        }
    }
}

/**
 * OpenAI API를 호출합니다.
 */
async function callOpenAIAPI(prompt, settings) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.openAIKey}`
        },
        body: JSON.stringify({
            model: 'o4-mini',
            messages: [{ role: 'user', content: prompt }],
            max_completion_tokens: 30000,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API 오류: ${response.status} - ${errorData.error?.message || '알 수 없는 오류'}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim();
}

/**
 * Gemini API를 호출합니다.
 */
async function callGeminiAPI(prompt, settings, modelId) {
    const modelConfig = AI_MODELS[modelId];
    const response = await fetch(`${modelConfig.endpoint}?key=${settings.geminiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: modelConfig.temperature,
                maxOutputTokens: modelConfig.maxTokens
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API 오류: ${response.status} - ${errorData.error?.message || '알 수 없는 오류'}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

/**
 * 선택된 AI 모델로 요약을 생성하고 표시합니다.
 */
async function fetchAndDisplaySummary() {
    showLoadingMessage();
    hideErrorMessage();

    try {
        // 설정 확인
        const settings = await getSettingsFromStorage();
        const modelConfig = AI_MODELS[settings.selectedModel];

        if (!modelConfig) {
            throw new Error('선택된 AI 모델이 유효하지 않습니다.');
        }

        // API 키 확인
        const requiredKey = modelConfig.apiKeyRequired === 'openai_api_key' ? settings.openAIKey : settings.geminiKey;
        if (!requiredKey) {
            throw new Error(`${modelConfig.name} 모델을 사용하려면 해당 API 키가 필요합니다. 설정 페이지에서 API 키를 입력해주세요.`);
        }

        // 스크립트 추출 및 프롬프트 구성
        const transcript = extractTranscriptText();
        if (!transcript) {
            throw new Error('스크립트를 추출할 수 없습니다. 스크립트가 활성화되어 있는지 확인해주세요.');
        }

        const fullPrompt = `${settings.userPrompt}\n\n${transcript}`;

        // 선택된 모델에 따라 API 호출
        let summary;
        if (modelConfig.provider === 'openai') {
            summary = await callOpenAIAPI(fullPrompt, settings);
        } else if (modelConfig.provider === 'gemini') {
            summary = await callGeminiAPI(fullPrompt, settings, settings.selectedModel);
        } else {
            throw new Error('지원하지 않는 AI 모델입니다.');
        }

        if (!summary) {
            throw new Error('API 응답에서 요약 내용을 찾을 수 없습니다.');
        }

        // 요약 저장 및 표시
        await storeSummary(currentVideoId, summary);
        displaySummary(summary);

        console.log(`[AI 요약] 요약 생성 완료 (모델: ${modelConfig.name})`);

    } catch (error) {
        console.error('[AI 요약] 요약 생성 오류:', error);
        showErrorMessage(`요약 생성 중 오류가 발생했습니다: ${error.message}`);
    } finally {
        hideLoadingMessage();
    }
}

/**
 * 간단한 마크다운을 HTML로 변환합니다.
 * @param {string} markdown - 마크다운 텍스트
 * @returns {string} HTML 텍스트
 */
function parseMarkdownToHTML(markdown) {
    if (!markdown) return '';

    let html = markdown;

    // 코드 블록 처리 (먼저 처리해서 다른 변환에서 제외)
    const codeBlocks = [];
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
        const index = codeBlocks.length;
        codeBlocks.push(code.trim());
        return `__CODE_BLOCK_${index}__`;
    });

    // 인라인 코드 처리
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (match, code) => {
        const index = inlineCodes.length;
        inlineCodes.push(code);
        return `__INLINE_CODE_${index}__`;
    });

    // 헤딩 처리
    html = html.replace(/^### (.*$)/gm, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1 class="md-h1">$1</h1>');

    // 볼드 처리
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="md-bold">$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong class="md-bold">$1</strong>');

    // 이탤릭 처리
    html = html.replace(/\*(.*?)\*/g, '<em class="md-italic">$1</em>');
    html = html.replace(/_(.*?)_/g, '<em class="md-italic">$1</em>');

    // 리스트 처리
    html = html.replace(/^[\-\*\+] (.+)$/gm, '<li class="md-list-item">$1</li>');
    html = html.replace(/(<li class="md-list-item">.*<\/li>)/s, '<ul class="md-list">$1</ul>');

    // 번호 리스트 처리
    html = html.replace(/^\d+\. (.+)$/gm, '<li class="md-ordered-item">$1</li>');
    html = html.replace(/(<li class="md-ordered-item">.*<\/li>)/s, '<ol class="md-ordered-list">$1</ol>');

    // 링크 처리
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link" target="_blank" rel="noopener">$1</a>');

    // 줄바꿈 처리
    html = html.replace(/\n\n/g, '</p><p class="md-paragraph">');
    html = html.replace(/\n/g, '<br>');

    // 문단으로 감싸기
    if (html && !html.startsWith('<')) {
        html = '<p class="md-paragraph">' + html + '</p>';
    }

    // 헤딩 태그 다음에 오는 불필요한 <br> 태그 제거
    html = html.replace(/(<\/h[1-6]>)<br>/g, '$1');

    // 리스트 내부의 불필요한 문단 태그 정리
    html = html.replace(/<(ul|ol)([^>]*)>([\s\S]*?)<\/\1>/g, (match, tag, attrs, content) => {
        // 리스트 내부의 빈 문단과 불필요한 <br> 태그 제거
        const cleanContent = content
            .replace(/<p class="md-paragraph"><\/p>/g, '') // 빈 문단 제거
            .replace(/<\/p><p class="md-paragraph">/g, '') // 문단 구분자 제거
            .replace(/<p class="md-paragraph">([^<]*)<\/p>/g, '$1') // 리스트 내 문단 태그 제거
            .replace(/<br\s*\/?>/g, '') // 리스트 내 불필요한 br 태그 제거
            .replace(/\s+/g, ' ') // 중복 공백 정리
            .trim();
        return `<${tag}${attrs}>${cleanContent}</${tag}>`;
    });

    // 헤딩과 다른 요소 사이의 불필요한 빈 문단 제거
    html = html.replace(/<\/(h[1-6])><p class="md-paragraph"><\/p>(<(ul|ol|pre|blockquote)[^>]*>)/g, '</$1>$2');

    // 코드 블록 복원
    codeBlocks.forEach((code, index) => {
        html = html.replace(`__CODE_BLOCK_${index}__`, `<pre class="md-code-block"><code>${escapeHtml(code)}</code></pre>`);
    });

    // 인라인 코드 복원
    inlineCodes.forEach((code, index) => {
        html = html.replace(`__INLINE_CODE_${index}__`, `<code class="md-inline-code">${escapeHtml(code)}</code>`);
    });

    return html;
}

/**
 * HTML 특수문자를 이스케이프합니다.
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 마크다운 스타일을 위한 CSS를 동적으로 추가합니다.
 */
function injectMarkdownStyles() {
    // YouTube 도메인이 아니면 스타일 주입하지 않음
    if (!window.location.hostname.includes('youtube.com')) {
        console.log('[AI 요약] YouTube가 아닌 도메인에서는 스타일을 주입하지 않습니다.');
        return;
    }

    // 이미 스타일이 추가되었는지 확인
    if (document.getElementById('ai-summary-markdown-styles')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'ai-summary-markdown-styles';
    style.textContent = `
        /* AI 요약 마크다운 스타일 - YouTube 전용 */
        ytd-transcript-renderer .md-h1,
        #${UI_CONTAINER_ID} .md-h1,
        #${SUMMARY_CONTENT_ID} .md-h1,
        #${COMMENTS_CONTENT_ID} .md-h1,
        #ai-summary-text .md-h1,
        #comments-summary-text .md-h1 {
            font-size: 1.5em !important;
            font-weight: bold !important;
            margin: 16px 0 8px 0 !important;
            color: var(--yt-spec-text-primary) !important;
            border-bottom: 2px solid var(--yt-spec-text-secondary) !important;
            padding-bottom: 4px !important;
        }
        
        ytd-transcript-renderer .md-h2,
        #${UI_CONTAINER_ID} .md-h2,
        #${SUMMARY_CONTENT_ID} .md-h2,
        #${COMMENTS_CONTENT_ID} .md-h2,
        #ai-summary-text .md-h2,
        #comments-summary-text .md-h2 {
            font-size: 1.3em !important;
            font-weight: bold !important;
            margin: 14px 0 6px 0 !important;
            color: var(--yt-spec-text-primary) !important;
        }
        
        ytd-transcript-renderer .md-h3,
        #${UI_CONTAINER_ID} .md-h3,
        #${SUMMARY_CONTENT_ID} .md-h3,
        #${COMMENTS_CONTENT_ID} .md-h3,
        #ai-summary-text .md-h3,
        #comments-summary-text .md-h3 {
            font-size: 1.1em !important;
            font-weight: bold !important;
            margin: 12px 0 4px 0 !important;
            color: var(--yt-spec-text-primary) !important;
        }
        
        ytd-transcript-renderer .md-bold,
        #${UI_CONTAINER_ID} .md-bold,
        #${SUMMARY_CONTENT_ID} .md-bold,
        #${COMMENTS_CONTENT_ID} .md-bold,
        #ai-summary-text .md-bold,
        #comments-summary-text .md-bold {
            font-weight: bold !important;
        }
        
        ytd-transcript-renderer .md-italic,
        #${UI_CONTAINER_ID} .md-italic,
        #${SUMMARY_CONTENT_ID} .md-italic,
        #${COMMENTS_CONTENT_ID} .md-italic,
        #ai-summary-text .md-italic,
        #comments-summary-text .md-italic {
            font-style: italic !important;
        }
        
        ytd-transcript-renderer .md-list,
        #${UI_CONTAINER_ID} .md-list,
        #${SUMMARY_CONTENT_ID} .md-list,
        #${COMMENTS_CONTENT_ID} .md-list,
        #ai-summary-text .md-list,
        #comments-summary-text .md-list {
            margin: 8px 0 !important;
            padding-left: 20px !important;
            list-style-type: disc !important;
        }
        
        ytd-transcript-renderer .md-ordered-list,
        #${UI_CONTAINER_ID} .md-ordered-list,
        #${SUMMARY_CONTENT_ID} .md-ordered-list,
        #${COMMENTS_CONTENT_ID} .md-ordered-list,
        #ai-summary-text .md-ordered-list,
        #comments-summary-text .md-ordered-list {
            margin: 8px 0 !important;
            padding-left: 20px !important;
            list-style-type: decimal !important;
        }
        
        ytd-transcript-renderer .md-list-item,
        ytd-transcript-renderer .md-ordered-item,
        #${UI_CONTAINER_ID} .md-list-item,
        #${UI_CONTAINER_ID} .md-ordered-item,
        #${SUMMARY_CONTENT_ID} .md-list-item,
        #${SUMMARY_CONTENT_ID} .md-ordered-item,
        #${COMMENTS_CONTENT_ID} .md-list-item,
        #${COMMENTS_CONTENT_ID} .md-ordered-item,
        #ai-summary-text .md-list-item,
        #ai-summary-text .md-ordered-item,
        #comments-summary-text .md-list-item,
        #comments-summary-text .md-ordered-item {
            margin: 4px 0 !important;
            line-height: 1.4 !important;
        }
        
        ytd-transcript-renderer .md-paragraph,
        #${UI_CONTAINER_ID} .md-paragraph,
        #${SUMMARY_CONTENT_ID} .md-paragraph,
        #${COMMENTS_CONTENT_ID} .md-paragraph,
        #ai-summary-text .md-paragraph,
        #comments-summary-text .md-paragraph {
            margin: 8px 0 !important;
            line-height: 1.5 !important;
        }
        
        ytd-transcript-renderer .md-code-block,
        #${UI_CONTAINER_ID} .md-code-block,
        #${SUMMARY_CONTENT_ID} .md-code-block,
        #${COMMENTS_CONTENT_ID} .md-code-block,
        #ai-summary-text .md-code-block,
        #comments-summary-text .md-code-block {
            background-color: var(--yt-spec-badge-chip-background) !important;
            border: 1px solid var(--yt-spec-10-percent-layer) !important;
            border-radius: 4px !important;
            padding: 12px !important;
            margin: 8px 0 !important;
            overflow-x: auto !important;
            font-family: 'Courier New', Consolas, monospace !important;
            font-size: 0.9em !important;
        }
        
        ytd-transcript-renderer .md-code-block code,
        #${UI_CONTAINER_ID} .md-code-block code,
        #${SUMMARY_CONTENT_ID} .md-code-block code,
        #${COMMENTS_CONTENT_ID} .md-code-block code,
        #ai-summary-text .md-code-block code,
        #comments-summary-text .md-code-block code {
            background: none !important;
            padding: 0 !important;
            border: none !important;
        }
        
        ytd-transcript-renderer .md-inline-code,
        #${UI_CONTAINER_ID} .md-inline-code,
        #${SUMMARY_CONTENT_ID} .md-inline-code,
        #${COMMENTS_CONTENT_ID} .md-inline-code,
        #ai-summary-text .md-inline-code,
        #comments-summary-text .md-inline-code {
            background-color: var(--yt-spec-badge-chip-background) !important;
            border: 1px solid var(--yt-spec-10-percent-layer) !important;
            border-radius: 3px !important;
            padding: 2px 4px !important;
            font-family: 'Courier New', Consolas, monospace !important;
            font-size: 0.9em !important;
        }
        
        ytd-transcript-renderer .md-link,
        #${UI_CONTAINER_ID} .md-link,
        #${SUMMARY_CONTENT_ID} .md-link,
        #${COMMENTS_CONTENT_ID} .md-link,
        #ai-summary-text .md-link,
        #comments-summary-text .md-link {
            color: var(--yt-spec-text-primary-inverse) !important;
            background-color: var(--yt-spec-call-to-action) !important;
            text-decoration: none !important;
            padding: 2px 4px !important;
            border-radius: 3px !important;
            transition: opacity 0.2s !important;
        }
        
        ytd-transcript-renderer .md-link:hover,
        #${UI_CONTAINER_ID} .md-link:hover,
        #${SUMMARY_CONTENT_ID} .md-link:hover,
        #${COMMENTS_CONTENT_ID} .md-link:hover,
        #ai-summary-text .md-link:hover,
        #comments-summary-text .md-link:hover {
            opacity: 0.8 !important;
        }
        
        ytd-transcript-renderer #${SUMMARY_CONTENT_ID} p:first-child,
        #${UI_CONTAINER_ID} #${SUMMARY_CONTENT_ID} p:first-child,
        ytd-transcript-renderer #${COMMENTS_CONTENT_ID} p:first-child,
        #${UI_CONTAINER_ID} #${COMMENTS_CONTENT_ID} p:first-child,
        ytd-transcript-renderer #ai-summary-text p:first-child,
        #${UI_CONTAINER_ID} #ai-summary-text p:first-child,
        ytd-transcript-renderer #comments-summary-text p:first-child,
        #${UI_CONTAINER_ID} #comments-summary-text p:first-child {
            margin-top: 0 !important;
        }
        
        ytd-transcript-renderer #${SUMMARY_CONTENT_ID} p:last-child,
        #${UI_CONTAINER_ID} #${SUMMARY_CONTENT_ID} p:last-child,
        ytd-transcript-renderer #${COMMENTS_CONTENT_ID} p:last-child,
        #${UI_CONTAINER_ID} #${COMMENTS_CONTENT_ID} p:last-child,
        ytd-transcript-renderer #ai-summary-text p:last-child,
        #${UI_CONTAINER_ID} #ai-summary-text p:last-child,
        ytd-transcript-renderer #comments-summary-text p:last-child,
        #${UI_CONTAINER_ID} #comments-summary-text p:last-child {
            margin-bottom: 0 !important;
        }

        /* 복사 및 새로고침 버튼 스타일 - YouTube 전용 */
        ytd-transcript-renderer .yt-ai-summary-copy-button,
        ytd-transcript-renderer .yt-ai-summary-refresh-button,
        #${UI_CONTAINER_ID} .yt-ai-summary-copy-button,
        #${UI_CONTAINER_ID} .yt-ai-summary-refresh-button {
            /* 기본 버튼 스타일 */
            background: none !important;
            background-color: transparent !important;
            background-image: none !important;
            border: none !important;
            border-width: 0 !important;
            border-style: none !important;
            cursor: pointer !important;
            padding: 8px !important;
            margin: 0 !important;
            border-radius: 4px !important;
            outline: none !important;
            
            /* 레이아웃 */
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 32px !important;
            height: 32px !important;
            min-width: 32px !important;
            min-height: 32px !important;
            max-width: 32px !important;
            max-height: 32px !important;
            
            /* 위치 */
            position: relative !important;
            top: auto !important;
            left: auto !important;
            right: auto !important;
            bottom: auto !important;
            
            /* 가시성 */
            visibility: visible !important;
            opacity: 1 !important;
            overflow: visible !important;
            
            /* 기타 */
            box-sizing: border-box !important;
            font-size: inherit !important;
            font-family: inherit !important;
            color: var(--yt-spec-text-secondary) !important;
            transition: all 0.2s ease !important;
            
            /* YouTube 스타일 강제 오버라이드 */
            transform: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            text-decoration: none !important;
            text-transform: none !important;
            letter-spacing: normal !important;
            line-height: normal !important;
            
            /* 플렉스 속성 */
            flex-shrink: 0 !important;
            flex-grow: 0 !important;
            flex-basis: auto !important;
        }

        /* 호버 상태 - YouTube 전용 */
        ytd-transcript-renderer .yt-ai-summary-copy-button:hover:not(:disabled),
        ytd-transcript-renderer .yt-ai-summary-refresh-button:hover,
        #${UI_CONTAINER_ID} .yt-ai-summary-copy-button:hover:not(:disabled),
        #${UI_CONTAINER_ID} .yt-ai-summary-refresh-button:hover {
            background-color: var(--yt-spec-badge-chip-background) !important;
            color: var(--yt-spec-text-primary) !important;
            transform: none !important;
            filter: none !important;
        }

        /* 비활성화 상태 - YouTube 전용 */
        ytd-transcript-renderer .yt-ai-summary-copy-button:disabled,
        #${UI_CONTAINER_ID} .yt-ai-summary-copy-button:disabled {
            opacity: 0.5 !important;
            cursor: not-allowed !important;
            background-color: transparent !important;
        }

        /* SVG 아이콘 스타일 - YouTube 전용 */
        ytd-transcript-renderer .yt-ai-summary-copy-button svg,
        ytd-transcript-renderer .yt-ai-summary-refresh-button svg,
        #${UI_CONTAINER_ID} .yt-ai-summary-copy-button svg,
        #${UI_CONTAINER_ID} .yt-ai-summary-refresh-button svg {
            /* 크기 */
            width: 16px !important;
            height: 16px !important;
            min-width: 16px !important;
            min-height: 16px !important;
            max-width: 16px !important;
            max-height: 16px !important;
            
            /* SVG 기본 속성 */
            fill: none !important;
            stroke: currentColor !important;
            stroke-width: 2 !important;
            stroke-linecap: round !important;
            stroke-linejoin: round !important;
            stroke-dasharray: none !important;
            stroke-dashoffset: 0 !important;
            
            /* 레이아웃 */
            display: block !important;
            position: relative !important;
            top: auto !important;
            left: auto !important;
            
            /* 가시성 */
            visibility: visible !important;
            opacity: 1 !important;
            overflow: visible !important;
            
            /* 기타 */
            pointer-events: none !important;
            vertical-align: middle !important;
            flex-shrink: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            background: none !important;
            
            /* YouTube 스타일 강제 오버라이드 */
            transform: none !important;
            filter: none !important;
            clip-path: none !important;
            mask: none !important;
        }

        /* SVG 내부 요소들 - YouTube 전용 */
        ytd-transcript-renderer .yt-ai-summary-copy-button svg *,
        ytd-transcript-renderer .yt-ai-summary-refresh-button svg *,
        #${UI_CONTAINER_ID} .yt-ai-summary-copy-button svg *,
        #${UI_CONTAINER_ID} .yt-ai-summary-refresh-button svg * {
            stroke: inherit !important;
            fill: inherit !important;
            stroke-width: inherit !important;
            stroke-linecap: inherit !important;
            stroke-linejoin: inherit !important;
            opacity: 1 !important;
            visibility: visible !important;
            display: inherit !important;
            transform: none !important;
            filter: none !important;
        }

        /* 버튼 컨테이너 스타일 강화 - YouTube 전용 */
        ytd-transcript-renderer .yt-ai-summary-tabs,
        #${UI_CONTAINER_ID} .yt-ai-summary-tabs {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            width: 100% !important;
            visibility: visible !important;
            opacity: 1 !important;
            box-sizing: border-box !important;
        }

        ytd-transcript-renderer .yt-ai-summary-tabs > div:last-child,
        #${UI_CONTAINER_ID} .yt-ai-summary-tabs > div:last-child {
            display: flex !important;
            gap: 8px !important;
            align-items: center !important;
            visibility: visible !important;
            opacity: 1 !important;
        }`;

    document.head.appendChild(style);
}

// --- 스토리지 관련 함수들 ---

/**
 * 로컬 스토리지에서 설정을 가져옵니다.
 * @returns {Promise<Object>} 설정 객체
 */
async function getSettingsFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['openai_api_key', 'gemini_api_key', 'youtube_api_key', 'user_prompt', 'comments_prompt', 'selected_ai_model'], (result) => {
            resolve({
                openAIKey: result.openai_api_key || null,
                geminiKey: result.gemini_api_key || null,
                youtubeAPIKey: result.youtube_api_key || null,
                userPrompt: result.user_prompt || userPrompt,
                commentsPrompt: result.comments_prompt || commentsPrompt,
                selectedModel: result.selected_ai_model || 'openai-o4-mini'
            });
        });
    });
}

/**
 * 요약 내용을 저장합니다.
 */
async function storeSummary(videoId, summary) {
    return new Promise((resolve) => {
        const key = `summary_${videoId}`;
        chrome.storage.local.set({ [key]: summary }, () => {
            console.log(`[AI 요약] 요약 저장됨: ${videoId}`);
            resolve();
        });
    });
}

/**
 * 저장된 요약 내용을 가져옵니다.
 */
async function getStoredSummary(videoId) {
    return new Promise((resolve) => {
        const key = `summary_${videoId}`;
        chrome.storage.local.get([key], (result) => {
            resolve(result[key] || null);
        });
    });
}

/**
 * 현재 YouTube 동영상 ID를 가져옵니다.
 */
function getCurrentVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
}

/**
 * URL에서 동영상 ID를 추출합니다.
 */
function getVideoIdFromUrl(url) {
    if (!url) return null;
    const urlParams = new URLSearchParams(new URL(url).search);
    return urlParams.get('v');
}

/**
 * 스크립트 패널 내부에서 우리의 UI가 제거되었는지 확인하고 필요시 복구합니다.
 * @param {HTMLElement} transcriptRenderer - ytd-transcript-renderer 요소
 */
function checkAndRestoreUI(transcriptRenderer) {
    // 현재 동영상 페이지가 아니면 복구하지 않음
    if (!window.location.href.includes('/watch?v=')) {
        return;
    }

    if (!transcriptRenderer) {
        console.log('[AI 요약] checkAndRestoreUI: transcriptRenderer가 없음');
        return;
    }

    // 우리의 UI가 제거되었는지 확인
    const existingUI = document.getElementById(UI_CONTAINER_ID);
    const transcriptContent = transcriptRenderer.querySelector('div#content.ytd-transcript-renderer');

    if (!existingUI && transcriptContent) {
        console.log('[AI 요약] UI가 제거된 것을 감지. UI 복구 시도.');

        // 현재 비디오 ID 업데이트
        const newVideoId = getCurrentVideoId();
        if (newVideoId) {
            currentVideoId = newVideoId;
            // UI 다시 삽입
            initializeExtension(transcriptRenderer);
        }
    } else if (existingUI && transcriptContent) {
        // UI는 있지만 올바른 위치에 있지 않을 수 있음 - 부모 확인
        const uiParent = existingUI.parentElement;
        if (!uiParent || !transcriptContent.contains(existingUI)) {
            console.log('[AI 요약] UI가 잘못된 위치에 있음. 재배치 시도.');

            // 기존 UI 제거 후 재삽입
            existingUI.remove();

            const newVideoId = getCurrentVideoId();
            if (newVideoId) {
                currentVideoId = newVideoId;
                initializeExtension(transcriptRenderer);
            }
        } else {
            // UI가 올바른 위치에 있는 경우, 탭 기능이 정상 작동하는지 확인
            const scriptTabBtn = document.getElementById(SCRIPT_TAB_ID);
            const summaryTabBtn = document.getElementById(SUMMARY_TAB_ID);
            const summaryContent = document.getElementById(SUMMARY_CONTENT_ID);

            if (!scriptTabBtn || !summaryTabBtn || !summaryContent) {
                console.log('[AI 요약] UI는 있지만 탭 요소들이 누락됨. UI 재생성.');
                existingUI.remove();

                const newVideoId = getCurrentVideoId();
                if (newVideoId) {
                    currentVideoId = newVideoId;
                    initializeExtension(transcriptRenderer);
                }
            }
        }
    }
}

/**
 * 로딩 메시지를 표시합니다 (경과 시간 타이머 포함).
 */
function showLoadingMessage() {
    const loadingElement = document.getElementById('ai-summary-loading');
    const summaryTextElement = document.getElementById('ai-summary-text');
    const refreshButton = document.getElementById(REFRESH_BUTTON_ID);

    if (loadingElement) {
        loadingElement.style.display = 'block';
        loadingElement.textContent = 'AI 응답을 기다리는 중... (0초)';
    }
    if (summaryTextElement) {
        summaryTextElement.textContent = '';
    }
    if (refreshButton) {
        refreshButton.classList.add('loading');
    }

    // 타이머 시작
    loadingStartTime = Date.now();
    if (loadingTimer) {
        clearInterval(loadingTimer);
    }

    loadingTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - loadingStartTime) / 1000);
        if (loadingElement && loadingElement.style.display !== 'none') {
            loadingElement.textContent = `AI 응답을 기다리는 중... (${elapsed}초)`;
        }
    }, 1000);
}

/**
 * 로딩 메시지를 숨깁니다.
 */
function hideLoadingMessage() {
    const loadingElement = document.getElementById('ai-summary-loading');
    const refreshButton = document.getElementById(REFRESH_BUTTON_ID);

    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    if (refreshButton) {
        refreshButton.classList.remove('loading');
    }

    // 타이머 정리
    if (loadingTimer) {
        clearInterval(loadingTimer);
        loadingTimer = null;
    }
    loadingStartTime = null;
}

/**
 * 에러 메시지를 표시합니다.
 */
function showErrorMessage(message) {
    const errorElement = document.getElementById('ai-summary-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

/**
 * 에러 메시지를 숨깁니다.
 */
function hideErrorMessage() {
    const errorDiv = document.getElementById('ai-summary-error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

// === 댓글 수집 및 요약 기능 ===

/**
 * 댓글 수집 및 요약 프로세스를 시작합니다.
 */
async function collectComments() {
    const commentsContent = document.getElementById(COMMENTS_CONTENT_ID);
    if (!commentsContent) return;

    // 이미 수집 중이라면 중단
    if (isCollectingComments) {
        console.log('[댓글 요약] 이미 댓글 수집 중입니다.');
        return;
    }

    const videoId = getCurrentVideoId();
    if (!videoId) {
        showCommentsErrorMessage('비디오 ID를 가져올 수 없습니다.');
        return;
    }

    // 1. 저장된 댓글 요약이 있는지 먼저 확인 (AI 요약과 동일한 방식)
    const storedSummary = await getStoredCommentsSummary(videoId);
    if (storedSummary) {
        console.log('[댓글 요약] 저장된 댓글 요약 발견, 표시 중...');
        displayCommentsSummary(storedSummary);
        return;
    }

    // 2. 저장된 요약이 없으면 새로 수집 및 생성
    console.log('[댓글 요약] 저장된 댓글 요약이 없어 새로 수집 중...');
    await fetchAndDisplayCommentsCollection();
}

/**
 * 댓글을 수집하고 요약을 생성합니다.
 */
async function fetchAndDisplayCommentsCollection() {
    const videoId = getCurrentVideoId();

    try {
        isCollectingComments = true;
        collectedComments = [];
        commentCollectionProgress = { current: 0, total: 100 };

        showCommentsLoadingMessage();

        // 설정 확인
        const settings = await getSettingsFromStorage();

        // YouTube API 키가 있으면 API 사용, 없으면 DOM 기반 수집
        if (settings.youtubeAPIKey) {
            console.log('[댓글 요약] YouTube API 키 발견. API 기반 수집 시작.');
            try {
                collectedComments = await collectCommentsViaYouTubeAPI(videoId, settings.youtubeAPIKey);
            } catch (apiError) {
                console.warn('[댓글 요약] YouTube API 수집 실패, DOM 기반으로 전환:', apiError);
                const friendlyMessage = getYouTubeAPIErrorMessage(apiError);

                // API 실패 시 사용자에게 알리고 DOM 기반으로 전환할지 묻기
                const commentsTextElement = document.getElementById('comments-summary-text');
                if (commentsTextElement) {
                    commentsTextElement.innerHTML = `
                        <div style="padding: 20px; text-align: center;">
                            <div style="margin-bottom: 12px; color: #d32f2f;">YouTube API 오류</div>
                            <div style="margin-bottom: 12px; font-size: 14px;">${friendlyMessage}</div>
                            <div style="margin: 12px 0;">
                                <button onclick="collectCommentsWithDOM()" style="margin-right: 8px; padding: 8px 16px; background: #ff0000; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                    DOM 기반 수집으로 진행
                                </button>
                                <button onclick="location.href='${chrome.runtime.getURL('options.html')}'" style="padding: 8px 16px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                    설정 페이지로
                                </button>
                            </div>
                        </div>
                    `;
                }
                return;
            }
        } else {
            console.log('[댓글 요약] YouTube API 키 없음. DOM 기반 수집 시작.');
            await collectCommentsWithDOM();
        }

        // 4. AI 요약 요청
        await fetchAndDisplayCommentsSummary();

    } catch (error) {
        console.error('[댓글 요약] 댓글 수집 중 오류:', error);
        showCommentsErrorMessage(error.message);
    } finally {
        isCollectingComments = false;
        hideCommentsLoadingMessage();
    }
}

/**
 * DOM 기반으로 댓글을 수집합니다 (기존 방식).
 */
async function collectCommentsWithDOM() {
    console.log('[댓글 요약] DOM 기반 댓글 수집 시작');

    // 1. 댓글 섹션으로 스크롤
    const commentsSection = await scrollToCommentsSection();
    if (!commentsSection) {
        throw new Error('댓글 섹션을 찾을 수 없습니다.');
    }

    // 2. 인기순 정렬 확인/설정
    await ensureTopCommentsSort();

    // 3. 댓글 수집 시작
    await collectTopComments();
}

/**
 * 댓글 섹션으로 스크롤합니다.
 */
async function scrollToCommentsSection() {
    return new Promise((resolve) => {
        const findComments = () => {
            const commentsSection = document.querySelector(COMMENT_SELECTORS.commentSection);
            if (commentsSection) {
                commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setTimeout(() => resolve(commentsSection), 1000);
            } else {
                // 댓글 섹션이 없으면 페이지 하단으로 스크롤하여 로딩 유도
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                setTimeout(findComments, 2000);
            }
        };
        findComments();
    });
}

/**
 * 인기순 정렬을 확인하고 설정합니다.
 */
async function ensureTopCommentsSort() {
    return new Promise((resolve) => {
        const sortButton = document.querySelector(COMMENT_SELECTORS.sortButton);
        if (sortButton) {
            // 현재 정렬 상태 확인 (일반적으로 "인기순"이 기본값)
            setTimeout(() => resolve(), 500);
        } else {
            setTimeout(() => resolve(), 500);
        }
    });
}

/**
 * 상위 댓글들을 수집합니다.
 */
async function collectTopComments() {
    const maxComments = 100;
    const maxRepliesPerComment = 10;
    let attemptCount = 0;
    const maxAttempts = 20;

    while (collectedComments.length < maxComments && attemptCount < maxAttempts) {
        attemptCount++;

        // 현재 화면에 있는 댓글들 수집
        const commentThreads = document.querySelectorAll(COMMENT_SELECTORS.commentItems);

        for (let i = collectedComments.length; i < commentThreads.length && collectedComments.length < maxComments; i++) {
            const thread = commentThreads[i];
            const commentData = await extractCommentData(thread, maxRepliesPerComment);

            if (commentData) {
                collectedComments.push(commentData);
                commentCollectionProgress.current = collectedComments.length;
                updateCommentsProgress();
            }
        }

        // 더 많은 댓글을 로딩하기 위해 스크롤
        if (collectedComments.length < maxComments) {
            const lastComment = commentThreads[commentThreads.length - 1];
            if (lastComment) {
                lastComment.scrollIntoView({ behavior: 'smooth', block: 'end' });
                await new Promise(resolve => setTimeout(resolve, 2000)); // 로딩 대기
            } else {
                break; // 더 이상 댓글이 없음
            }
        }
    }

    console.log(`[댓글 요약] 총 ${collectedComments.length}개의 댓글을 수집했습니다.`);
}

/**
 * 개별 댓글 데이터를 추출합니다.
 */
async function extractCommentData(commentThread, maxReplies) {
    try {
        const mainComment = commentThread.querySelector('ytd-comment-renderer#comment');
        if (!mainComment) return null;

        const authorElement = mainComment.querySelector(COMMENT_SELECTORS.authorName);
        const contentElement = mainComment.querySelector(COMMENT_SELECTORS.commentText);
        const likeElement = mainComment.querySelector(COMMENT_SELECTORS.likeCount);

        const author = authorElement ? authorElement.textContent.trim() : '익명';
        const content = contentElement ? contentElement.textContent.trim() : '';
        const likes = likeElement ? parseInt(likeElement.textContent.trim()) || 0 : 0;

        if (!content) return null;

        const commentData = {
            author,
            content,
            likes,
            replies: []
        };

        // 답글 수집
        const replyButton = commentThread.querySelector(COMMENT_SELECTORS.replyButton);
        if (replyButton && !replyButton.hasAttribute('hidden')) {
            // 답글 더보기 버튼 클릭
            replyButton.click();
            await new Promise(resolve => setTimeout(resolve, 1000)); // 로딩 대기

            const replyElements = commentThread.querySelectorAll('ytd-comment-replies-renderer ytd-comment-renderer');
            for (let i = 0; i < Math.min(replyElements.length, maxReplies); i++) {
                const reply = extractReplyData(replyElements[i]);
                if (reply) {
                    commentData.replies.push(reply);
                }
            }
        }

        return commentData;
    } catch (error) {
        console.warn('[댓글 요약] 댓글 추출 중 오류:', error);
        return null;
    }
}

/**
 * 답글 데이터를 추출합니다.
 */
function extractReplyData(replyElement) {
    try {
        const authorElement = replyElement.querySelector(COMMENT_SELECTORS.authorName);
        const contentElement = replyElement.querySelector(COMMENT_SELECTORS.commentText);
        const likeElement = replyElement.querySelector(COMMENT_SELECTORS.likeCount);

        const author = authorElement ? authorElement.textContent.trim() : '익명';
        const content = contentElement ? contentElement.textContent.trim() : '';
        const likes = likeElement ? parseInt(likeElement.textContent.trim()) || 0 : 0;

        if (!content) return null;

        return { author, content, likes };
    } catch (error) {
        console.warn('[댓글 요약] 답글 추출 중 오류:', error);
        return null;
    }
}

/**
 * 수집된 댓글들을 AI에게 전송하여 요약을 받습니다.
 */
async function fetchAndDisplayCommentsSummary() {
    if (collectedComments.length === 0) {
        throw new Error('수집된 댓글이 없습니다.');
    }

    // AI 요약 로딩 메시지 표시 (타이머 포함)
    showCommentsAISummaryLoadingMessage();

    const settings = await getSettingsFromStorage();
    const modelConfig = AI_MODELS[settings.selectedModel];

    if (!modelConfig) {
        throw new Error('선택된 AI 모델이 유효하지 않습니다.');
    }

    // API 키 확인
    const requiredKey = modelConfig.apiKeyRequired === 'openai_api_key' ? settings.openAIKey : settings.geminiKey;
    if (!requiredKey) {
        throw new Error(`${modelConfig.name} 모델을 사용하려면 해당 API 키가 필요합니다. 설정 페이지에서 API 키를 입력해주세요.`);
    }

    // 댓글 데이터를 텍스트로 변환
    const commentsText = formatCommentsForAI(collectedComments);

    const prompt = settings.commentsPrompt || commentsPrompt;
    const fullPrompt = `${prompt}\n\n${commentsText}`;

    try {
        // 선택된 모델에 따라 API 호출
        let summary;
        if (modelConfig.provider === 'openai') {
            summary = await callOpenAIAPI(fullPrompt, settings);
        } else if (modelConfig.provider === 'gemini') {
            summary = await callGeminiAPI(fullPrompt, settings, settings.selectedModel);
        } else {
            throw new Error('지원하지 않는 AI 모델입니다.');
        }

        if (!summary) {
            throw new Error('AI 응답에서 요약 내용을 찾을 수 없습니다.');
        }

        // 요약 결과 저장 및 표시
        const videoId = getCurrentVideoId();
        await storeCommentsSummary(videoId, summary);
        displayCommentsSummary(summary);

        console.log(`[댓글 요약] 요약 생성 완료 (모델: ${modelConfig.name})`);

    } catch (error) {
        console.error('[댓글 요약] AI 요약 생성 오류:', error);
        throw error;
    } finally {
        // 타이머 정리
        if (commentsLoadingTimer) {
            clearInterval(commentsLoadingTimer);
            commentsLoadingTimer = null;
        }
        commentsLoadingStartTime = null;
    }
}

/**
 * 수집된 댓글들을 AI가 처리할 수 있는 텍스트 형태로 변환합니다.
 */
function formatCommentsForAI(comments) {
    let formatted = `총 ${comments.length}개의 댓글 (인기순):\n\n`;

    comments.forEach((comment, index) => {
        formatted += `${index + 1}. ${comment.author} (👍 ${comment.likes})\n`;
        formatted += `${comment.content}\n`;

        if (comment.replies.length > 0) {
            formatted += `답글 (${comment.replies.length}개):\n`;
            comment.replies.forEach((reply, replyIndex) => {
                formatted += `  └ ${reply.author}: ${reply.content}\n`;
            });
        }
        formatted += '\n';
    });

    return formatted;
}

/**
 * 댓글 요약을 화면에 표시합니다.
 */
function displayCommentsSummary(summary) {
    const commentsTextElement = document.getElementById('comments-summary-text');
    if (commentsTextElement) {
        // 원본 마크다운 텍스트 저장 (복사용)
        currentCommentsSummaryText = summary;

        // 마크다운 스타일 주입
        injectMarkdownStyles();

        // 마크다운을 HTML로 변환하여 표시
        const htmlContent = parseMarkdownToHTML(summary);
        commentsTextElement.innerHTML = htmlContent;

        // 복사 버튼 활성화
        const copyButton = document.getElementById('ai-summary-copy-button');
        if (copyButton) {
            copyButton.disabled = false;
            copyButton.style.opacity = '1';
        }
    }
}

/**
 * 댓글 수집 진행 상황을 업데이트합니다.
 */
function updateCommentsProgress() {
    const commentsTextElement = document.getElementById('comments-summary-text');
    if (!commentsTextElement) return;

    const progress = Math.round((commentCollectionProgress.current / commentCollectionProgress.total) * 100);
    commentsTextElement.innerHTML = `
        <div style="padding: 20px; text-align: center;">
            <div style="margin-bottom: 12px;">댓글 수집 중...</div>
            <div style="background: #f0f0f0; border-radius: 10px; height: 20px; overflow: hidden;">
                <div style="background: #ff0000; height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
            </div>
            <div style="margin-top: 8px; font-size: 12px; color: #666;">
                ${commentCollectionProgress.current} / ${commentCollectionProgress.total} 댓글 수집됨
            </div>
        </div>
    `;
}

/**
 * 댓글 로딩 메시지를 표시합니다.
 */
function showCommentsLoadingMessage() {
    const commentsLoadingElement = document.getElementById('comments-summary-loading');
    const commentsTextElement = document.getElementById('comments-summary-text');

    if (commentsLoadingElement) {
        commentsLoadingElement.style.display = 'block';
    }
    if (commentsTextElement) {
        commentsTextElement.innerHTML = '';
    }

    // 설정 확인하여 적절한 메시지 표시
    getSettingsFromStorage().then(settings => {
        const isAPIMode = !!settings.youtubeAPIKey;
        const methodText = isAPIMode ? 'YouTube API를 통해' : 'DOM 스크롤을 통해';
        const detailText = isAPIMode
            ? '모든 댓글을 백그라운드에서 수집합니다.'
            : '인기순 상위 100개 댓글과 각각의 상위 10개 답글을 수집합니다.';

        if (commentsTextElement) {
            commentsTextElement.innerHTML = `
                <div style="padding: 20px; text-align: center;">
                    <div style="margin-bottom: 12px;">${methodText} 댓글을 수집하고 있습니다...</div>
                    <div style="font-size: 12px; color: #666;">
                        ${detailText}
                    </div>
                    ${isAPIMode ? '' : '<div style="font-size: 11px; color: #999; margin-top: 8px;">화면이 자동으로 스크롤될 수 있습니다.</div>'}
                </div>
            `;
        }
    });
}

/**
 * 댓글 AI 요약 로딩 메시지를 표시합니다 (경과 시간 타이머 포함).
 */
function showCommentsAISummaryLoadingMessage() {
    const commentsTextElement = document.getElementById('comments-summary-text');

    if (commentsTextElement) {
        commentsTextElement.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <div style="margin-bottom: 12px;">AI 댓글 요약을 생성하는 중... (0초)</div>
                <div style="font-size: 12px; color: #666;">
                    수집된 댓글을 AI가 분석하고 있습니다.
                </div>
            </div>
        `;
    }

    // 타이머 시작
    commentsLoadingStartTime = Date.now();
    if (commentsLoadingTimer) {
        clearInterval(commentsLoadingTimer);
    }

    commentsLoadingTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - commentsLoadingStartTime) / 1000);
        if (commentsTextElement && commentsTextElement.innerHTML.includes('AI 댓글 요약을 생성하는 중')) {
            commentsTextElement.innerHTML = `
                <div style="padding: 20px; text-align: center;">
                    <div style="margin-bottom: 12px;">AI 댓글 요약을 생성하는 중... (${elapsed}초)</div>
                    <div style="font-size: 12px; color: #666;">
                        수집된 댓글을 AI가 분석하고 있습니다.
                    </div>
                </div>
            `;
        }
    }, 1000);
}

/**
 * 댓글 로딩 메시지를 숨깁니다.
 */
function hideCommentsLoadingMessage() {
    const commentsLoadingElement = document.getElementById('comments-summary-loading');
    if (commentsLoadingElement) {
        commentsLoadingElement.style.display = 'none';
    }

    // 댓글 AI 요약 타이머 정리
    if (commentsLoadingTimer) {
        clearInterval(commentsLoadingTimer);
        commentsLoadingTimer = null;
    }
    commentsLoadingStartTime = null;
}

/**
 * 댓글 수집 오류 메시지를 표시합니다.
 */
function showCommentsErrorMessage(message) {
    const commentsErrorElement = document.getElementById('comments-summary-error');
    const commentsTextElement = document.getElementById('comments-summary-text');

    if (commentsErrorElement) {
        commentsErrorElement.textContent = message;
        commentsErrorElement.style.display = 'block';
    }

    if (commentsTextElement) {
        commentsTextElement.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #d32f2f;">
                <div style="margin-bottom: 8px; font-weight: bold;">댓글 수집 오류</div>
                <div style="font-size: 14px;">${message}</div>
                <button onclick="collectComments()" style="margin-top: 12px; padding: 8px 16px; background: #ff0000; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    다시 시도
                </button>
            </div>
        `;
    }
}

/**
 * 댓글 요약을 스토리지에 저장합니다.
 */
async function storeCommentsSummary(videoId, summary) {
    return new Promise((resolve) => {
        const key = `comments_summary_${videoId}`;
        chrome.storage.local.set({ [key]: summary }, () => {
            console.log(`[댓글 요약] 댓글 요약 저장됨: ${videoId}`);
            resolve();
        });
    });
}

/**
 * 저장된 댓글 요약을 불러옵니다.
 */
async function getStoredCommentsSummary(videoId) {
    return new Promise((resolve) => {
        const key = `comments_summary_${videoId}`;
        chrome.storage.local.get([key], (result) => {
            resolve(result[key] || null);
        });
    });
}

/**
 * YouTube Data API를 사용하여 댓글을 수집합니다.
 * @param {string} videoId - YouTube 동영상 ID
 * @param {string} apiKey - YouTube Data API 키
 * @returns {Promise<Array>} 수집된 댓글 배열
 */
async function collectCommentsViaYouTubeAPI(videoId, apiKey) {
    console.log('[댓글 요약] YouTube API를 통한 댓글 수집 시작');

    const allComments = [];
    let pageToken = '';
    const maxCommentsPerPage = 100;
    const maxTotalComments = 100;

    try {
        while (allComments.length < maxTotalComments) {
            const url = `https://www.googleapis.com/youtube/v3/commentThreads` +
                `?part=snippet,replies` +
                `&videoId=${videoId}` +
                `&order=relevance` +
                `&maxResults=${Math.min(maxCommentsPerPage, maxTotalComments - allComments.length)}` +
                `&key=${apiKey}` +
                (pageToken ? `&pageToken=${pageToken}` : '');

            console.log(`[댓글 요약] API 호출: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);

            const response = await fetch(url);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`YouTube API 오류 (${response.status}): ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();

            // 댓글 데이터 파싱
            const comments = data.items.map(item => {
                const snippet = item.snippet.topLevelComment.snippet;
                const commentData = {
                    author: snippet.authorDisplayName,
                    content: snippet.textDisplay,
                    likes: snippet.likeCount || 0,
                    publishedAt: snippet.publishedAt,
                    replies: []
                };

                // 답글 처리 (최대 10개까지)
                if (item.replies && item.replies.comments) {
                    commentData.replies = item.replies.comments
                        .slice(0, 10)
                        .map(reply => ({
                            author: reply.snippet.authorDisplayName,
                            content: reply.snippet.textDisplay,
                            likes: reply.snippet.likeCount || 0,
                            publishedAt: reply.snippet.publishedAt
                        }));
                }

                return commentData;
            });

            allComments.push(...comments);
            commentCollectionProgress.current = allComments.length;
            updateCommentsProgress();

            // 다음 페이지가 있는지 확인
            if (!data.nextPageToken || allComments.length >= maxTotalComments) {
                break;
            }

            pageToken = data.nextPageToken;

            // API 호출 간격 조절 (과도한 요청 방지)
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`[댓글 요약] YouTube API로 총 ${allComments.length}개 댓글 수집 완료`);
        return allComments.slice(0, maxTotalComments);

    } catch (error) {
        console.error('[댓글 요약] YouTube API 호출 오류:', error);
        throw error;
    }
}

/**
 * YouTube API 오류를 사용자 친화적 메시지로 변환합니다.
 * @param {Error} error - API 오류
 * @returns {string} 사용자 친화적 오류 메시지
 */
function getYouTubeAPIErrorMessage(error) {
    const message = error.message;

    if (message.includes('403')) {
        if (message.includes('quotaExceeded')) {
            return 'YouTube API 일일 할당량을 초과했습니다. 내일 다시 시도하거나 DOM 기반 수집을 사용해주세요.';
        } else if (message.includes('disabled')) {
            return '이 동영상은 댓글이 비활성화되어 있습니다.';
        } else {
            return 'API 키가 유효하지 않거나 권한이 없습니다. 설정을 확인해주세요.';
        }
    } else if (message.includes('404')) {
        return '동영상을 찾을 수 없습니다. 비공개 동영상이거나 삭제된 동영상일 수 있습니다.';
    } else if (message.includes('400')) {
        return 'API 요청이 잘못되었습니다. 동영상 ID를 확인해주세요.';
    } else {
        return `YouTube API 오류: ${message}`;
    }
}

// DOM 기반 수집 함수를 전역 스코프에 노출
window.collectCommentsWithDOM = async function () {
    try {
        await collectCommentsWithDOM();
        await fetchAndDisplayCommentsSummary();
    } catch (error) {
        console.error('[댓글 요약] DOM 기반 수집 오류:', error);
        showCommentsErrorMessage(error.message);
    } finally {
        isCollectingComments = false;
        hideCommentsLoadingMessage();
    }
};
