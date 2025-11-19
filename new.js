// ==UserScript==
// @name          YouTube 자동 스크립트 표시
// @namespace     http://tampermonkey.net/
// @version       0.8.1
// @description   유튜브 영상 페이지에서 자동으로 "설명 더보기"를 클릭한 후 "스크립트 표시" 버튼을 클릭합니다.
// @author        AI Assistant & User
// @match        *://*.youtube.com/*
// @grant         none
// @run-at        document-idle
// ==/UserScript==

(function () {
    'use strict';

    const CLICK_ACTION_DELAY = 800;  // 클릭 후 DOM 변경을 기다리는 시간 (밀리초)
    const CHECK_INTERVAL = 600;      // 요소를 주기적으로 확인하는 간격 (밀리초)
    const MAX_ITERATIONS = 25;       // 각 단계별 최대 시도 횟수

    let iterationCount = 0;
    let currentStep = 'start_description_more';
    let scriptInterval = null;
    let actionTimeout = null; // setTimeout 핸들러 관리를 위해 추가

    function log(message) {
        console.log(`Tampermonkey (YT 자동 스크립트 v0.8.1): ${message}`);
    }

    function clickElement(element, elementName) {
        if (element && typeof element.click === 'function' &&
            element.offsetParent !== null && // 화면에 실제로 보이는지 (렌더링 트리)
            !element.hasAttribute('hidden') && // hidden 속성이 없는지
            !element.closest('[hidden]')) { // 부모 중에 hidden이 없는지

            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') {
                // log(`"${elementName}" 버튼은 스타일 상으로 클릭 불가능합니다. (display: ${style.display}, visibility: ${style.visibility}, pointerEvents: ${style.pointerEvents})`);
                return false;
            }
            log(`"${elementName}" 버튼을 클릭합니다.`);
            element.click();
            return true;
        }
        // if (element) {
        //     log(`"${elementName}" 버튼은 존재하지만 클릭할 수 없는 상태입니다. (offsetParent: ${element.offsetParent}, hidden: ${element.hasAttribute('hidden')}, closestHidden: ${element.closest('[hidden]')})`);
        // }
        return false;
    }

    function tryDescriptionMore() {
        log(`시도 ${iterationCount}/${MAX_ITERATIONS}: '설명 더보기' 버튼/상태 확인 중...`);

        const expander = document.querySelector('ytd-text-inline-expander#description-inline-expander');

        if (expander) {
            if (expander.hasAttribute('is-expanded')) {
                log("설명란이 'is-expanded' 속성을 가지고 있어 이미 확장된 상태로 판단합니다. '스크립트 표시' 단계로 넘어갑니다.");
                currentStep = 'start_transcript';
                iterationCount = 0; // 다음 단계를 위해 시도 횟수 초기화
                return;
            }

            const collapseButton = expander.querySelector(
                'tp-yt-paper-button#collapse:not([hidden]), ' +
                'tp-yt-paper-button#collapse-button:not([hidden]), ' +
                'button.yt-spec-button-shape-next[aria-label="접기"]:not([hidden]),' + // 한국어
                'button.yt-spec-button-shape-next[aria-label="Show less"]:not([hidden])' // 영어
            );
            if (collapseButton && collapseButton.offsetParent !== null && !collapseButton.closest('[hidden]')) {
                log("설명란 내 '간략히' 또는 'Show less' 버튼이 보여 이미 확장된 상태로 판단합니다. '스크립트 표시' 단계로 넘어갑니다.");
                currentStep = 'start_transcript';
                iterationCount = 0;
                return;
            }

            let moreButton = expander.querySelector(
                'button.yt-spec-button-shape-next[aria-label="펼치기"]:not([hidden]), ' + // 한국어 "펼치기"
                'button.yt-spec-button-shape-next[aria-label="Show more"]:not([hidden]), ' + // 영어 "Show more" (aria-label)
                'tp-yt-paper-button#expand[aria-label="펼치기"]:not([hidden]), ' +
                'tp-yt-paper-button#expand[aria-label="Show more"]:not([hidden]), ' +
                'tp-yt-paper-button#expand:not([hidden])'
            );

            if (!moreButton) {
                const textBasedButtons = expander.querySelectorAll('button:not([hidden]), tp-yt-paper-button:not([hidden])');
                for (const btn of textBasedButtons) {
                    const textContent = (btn.textContent || btn.innerText || "").trim();
                    const ariaLabel = btn.getAttribute('aria-label');
                    if ((textContent.includes("더보기") || textContent.startsWith("...더보기") || textContent.toLowerCase().includes("show more")) &&
                        ariaLabel !== "접기" && ariaLabel !== "Show less") {
                        moreButton = btn;
                        break;
                    }
                }
            }

            if (clickElement(moreButton, "설명 더보기 (ytd-text-inline-expander 내)")) {
                log("'설명 더보기' (ytd-text-inline-expander 내) 클릭 성공.");
                currentStep = 'wait_after_description_click';
                iterationCount = 0;
                if (actionTimeout) clearTimeout(actionTimeout);
                actionTimeout = setTimeout(() => {
                    currentStep = 'start_transcript';
                    iterationCount = 0; // 다음 단계 진입 시 초기화
                }, CLICK_ACTION_DELAY);
                return;
            }
        } else {
            log("'ytd-text-inline-expander#description-inline-expander' 요소를 찾을 수 없습니다. Fallback 선택자를 시도합니다.");
        }

        let fallbackMoreButton = null;
        const descInteraction = document.querySelector('#description-interaction');
        if (descInteraction) {
            const btnCandidate = descInteraction.querySelector('button.yt-spec-button-shape-next');
            if (btnCandidate) {
                const text = (btnCandidate.textContent || btnCandidate.innerText || "").trim();
                const label = btnCandidate.getAttribute('aria-label');
                if ((label === "펼치기" || label === "Show more") ||
                    ((text === "더보기" || text.toLowerCase() === "show more") && label !== "접기" && label !== "Show less")) {
                    fallbackMoreButton = btnCandidate;
                }
            }
        }

        if (clickElement(fallbackMoreButton, "설명 더보기 (Fallback #description-interaction)")) {
            log("'설명 더보기' (Fallback #description-interaction) 클릭 성공.");
            currentStep = 'wait_after_description_click';
            iterationCount = 0;
            if (actionTimeout) clearTimeout(actionTimeout);
            actionTimeout = setTimeout(() => {
                currentStep = 'start_transcript';
                iterationCount = 0;
            }, CLICK_ACTION_DELAY);
            return;
        }

        const descriptionContentExists = document.querySelector(
            '#description-inline-expander yt-attributed-string, #description-text, #description .content, ytd-expandable-video-description-body-renderer'
        );
        let visibleExpandButtonMissing = true;
        document.querySelectorAll(
            'ytd-text-inline-expander#description-inline-expander button, ' +
            'ytd-text-inline-expander#description-inline-expander tp-yt-paper-button, ' +
            '#description-interaction button'
        ).forEach(btn => {
            const text = (btn.textContent || btn.innerText || "").trim();
            const label = btn.getAttribute('aria-label');
            if (((label === '펼치기' || label === 'Show more') || text.includes('더보기') || text.startsWith('...더보기') || text.toLowerCase().includes("show more")) &&
                (label !== '접기' && label !== 'Show less') &&
                btn.offsetParent !== null && !btn.hasAttribute('hidden') && !btn.closest('[hidden]')) {
                visibleExpandButtonMissing = false;
            }
        });

        if (descriptionContentExists && visibleExpandButtonMissing) {
            log("'설명 더보기' 버튼이 없거나 이미 처리된 것으로 판단됩니다. '스크립트 표시' 단계로 넘어갑니다.");
            currentStep = 'start_transcript';
            iterationCount = 0;
            return;
        }

        log("'설명 더보기' 버튼을 아직 찾지 못했거나 클릭할 수 없습니다. 다음 시도...");
    }

    function tryTranscriptButton() {
        log(`시도 ${iterationCount}/${MAX_ITERATIONS}: '스크립트 표시' 버튼 확인 중...`);
        // "스크립트 표시" 버튼은 종종 "..." 메뉴 안에 있습니다.
        // 1. 액션 메뉴를 찾습니다.
        // 2. 액션 메뉴를 클릭합니다.
        // 3. "스크립트 표시" 항목을 찾아 클릭합니다.

        // 우선, 스크립트가 이미 표시되었는지 확인
        const transcriptRenderer = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"], ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"]');
        if (transcriptRenderer && transcriptRenderer.offsetParent !== null && !transcriptRenderer.hasAttribute('hidden') && window.getComputedStyle(transcriptRenderer).visibility !== 'hidden') {
            const transcriptContent = transcriptRenderer.querySelector('#content');
            if (transcriptContent && transcriptContent.offsetParent !== null) {
                log('스크립트 패널이 이미 열려 있는 것으로 보입니다.');
                currentStep = 'done';
                return;
            }
        }

        // "스크립트 표시" 버튼이 직접 보이는 경우 (구 UI 또는 특정 상황)
        // 한국어: "스크립트 표시", 영어: "Show transcript"
        const directTranscriptButton = document.querySelector(
            'button[aria-label="스크립트 표시"], button[aria-label="Show transcript"],' +
            'yt-button-renderer a[title="스크립트 표시"], yt-button-renderer a[title="Show transcript"]' // 다른 형태의 버튼
        );

        if (directTranscriptButton && directTranscriptButton.getAttribute('aria-pressed') === 'true') {
            log('스크립트가 이미 표시되어 있습니다 (aria-pressed).');
            currentStep = 'done';
            return;
        }

        if (clickElement(directTranscriptButton, "스크립트 표시 (직접 버튼)")) {
            log("'스크립트 표시 (직접 버튼)' 클릭 성공.");
            currentStep = 'done';
            return;
        }

        // "스크립트 표시" 버튼이 "..." (더보기 메뉴) 안에 있는 경우
        // 1. "더보기" 메뉴 버튼 찾기
        const menuButton = document.querySelector(
            'ytd-menu-renderer > yt-icon-button#button, ' + // 일반적인 더보기 버튼
            'button[aria-label="추가 작업"], button[aria-label="More actions"]' // 레이블 기반
        );

        if (menuButton && menuButton.offsetParent !== null && !menuButton.hasAttribute('hidden') && !menuButton.closest('[hidden]')) {
            // 메뉴가 아직 열려있지 않다면 클릭
            const menuPopup = document.querySelector('tp-yt-iron-dropdown.ytd-menu-popup-renderer, ytd-multi-page-menu-renderer');
            const isMenuOpen = menuPopup && (menuPopup.getAttribute('aria-hidden') === 'false' || menuPopup.style.display !== 'none');

            if (!isMenuOpen) {
                if (clickElement(menuButton, "더보기 메뉴")) {
                    log("'더보기 메뉴' 클릭 성공. 잠시 후 스크립트 표시 항목을 찾습니다.");
                    currentStep = 'wait_after_menu_click'; // 새 상태 추가
                    iterationCount = 0;
                    if (actionTimeout) clearTimeout(actionTimeout);
                    actionTimeout = setTimeout(() => {
                        currentStep = 'start_transcript_from_menu'; // 메뉴에서 찾는 단계
                        iterationCount = 0;
                    }, CLICK_ACTION_DELAY); // 메뉴가 열릴 시간
                    return;
                } else {
                    log("'더보기 메뉴'를 클릭할 수 없습니다.");
                }
            } else {
                // 메뉴가 이미 열려있다면 바로 메뉴 아이템 탐색 단계로
                log("'더보기 메뉴'가 이미 열려있습니다. '스크립트 표시' 항목 탐색을 시작합니다.");
                currentStep = 'start_transcript_from_menu';
                iterationCount = 0; // 여기서 iterationCount를 리셋
                // 바로 tryTranscriptFromMenu를 호출하기보다는 다음 인터벌에서 처리되도록 currentStep만 변경
                return; // 다음 인터벌에서 start_transcript_from_menu 실행
            }
        }

        if (currentStep !== 'wait_after_menu_click' && currentStep !== 'start_transcript_from_menu') {
            log("'스크립트 표시' 버튼 또는 '더보기 메뉴'를 찾을 수 없습니다. 다음 시도...");
        }
    }

    function tryTranscriptFromMenu() {
        log(`시도 ${iterationCount}/${MAX_ITERATIONS}: 메뉴 내 '스크립트 표시' 항목 확인 중...`);
        const transcriptMenuItem = Array.from(document.querySelectorAll(
            'ytd-menu-service-item-renderer yt-formatted-string,' + // 일반 메뉴 아이템
            'tp-yt-paper-item yt-formatted-string' // 다른 형태의 메뉴 아이템
        )).find(el => {
            const text = (el.textContent || el.innerText || "").trim();
            return text === "스크립트 표시" || text === "Show transcript";
        });

        if (transcriptMenuItem) {
            // 부모 요소 중 클릭 가능한 요소를 찾아 클릭 (ytd-menu-service-item-renderer 또는 tp-yt-paper-item)
            const clickableParent = transcriptMenuItem.closest('ytd-menu-service-item-renderer, tp-yt-paper-item');
            if (clickElement(clickableParent || transcriptMenuItem, "스크립트 표시 (메뉴 항목)")) {
                log("'스크립트 표시 (메뉴 항목)' 클릭 성공.");
                currentStep = 'done';
                return;
            } else {
                log("'스크립트 표시 (메뉴 항목)'을 클릭할 수 없습니다.");
            }
        } else {
            log("메뉴 내에서 '스크립트 표시' 항목을 찾지 못했습니다.");
            // 메뉴를 닫고 다시 시도하거나, 실패 처리 할 수 있음.
            // 여기서는 다음 인터벌에서 다시 시도하도록 둠 (iterationCount에 따라 실패 처리됨)
        }
        // 만약 못찾으면 iterationCount가 증가하고 MAX_ITERATIONS 도달 시 실패 처리됨.
    }


    function runMainLogic() {
        log("runMainLogic 실행: 상태 초기화 및 인터벌 시작.");
        if (scriptInterval) {
            clearInterval(scriptInterval);
            scriptInterval = null;
        }
        if (actionTimeout) { // 이전 페이지의 setTimeout 정리
            clearTimeout(actionTimeout);
            actionTimeout = null;
        }

        iterationCount = 0;
        currentStep = 'start_description_more'; // 항상 처음부터 시작

        scriptInterval = setInterval(() => {
            iterationCount++;
            if (iterationCount > MAX_ITERATIONS && currentStep !== 'done' && currentStep !== 'failed') {
                log(`현재 단계(${currentStep})에서 최대 시도 횟수 (${MAX_ITERATIONS}) 초과. 다음 단계 시도 또는 실패 처리.`);
                // 특정 단계에서 실패 시 다른 전략을 사용하거나 전체 실패로 이어질 수 있음
                // 예를 들어, 설명 더보기를 MAX_ITERATIONS 동안 못찾으면 스크립트 표시 시도도 의미 없을 수 있음
                // 여기서는 일단 실패로 간주.
                if (currentStep === 'start_description_more' || currentStep === 'wait_after_description_click') {
                    log("'설명 더보기' 관련 작업 실패. 스크립트를 중단합니다.");
                    currentStep = 'failed';
                } else if (currentStep === 'start_transcript' || currentStep === 'wait_after_menu_click' || currentStep === 'start_transcript_from_menu') {
                    log("'스크립트 표시' 관련 작업 실패. 스크립트를 중단합니다.");
                    currentStep = 'failed';
                }
            }

            switch (currentStep) {
                case 'start_description_more':
                    tryDescriptionMore();
                    break;
                case 'wait_after_description_click':
                    log("설명 더보기 클릭 후 대기 중..."); // setTimeout이 처리하므로 여기서는 대기 메시지만. iterationCount는 setTimeout 콜백에서 리셋.
                    break;
                case 'start_transcript':
                    tryTranscriptButton();
                    break;
                case 'wait_after_menu_click':
                    log("더보기 메뉴 클릭 후 대기 중..."); // setTimeout이 처리.
                    break;
                case 'start_transcript_from_menu':
                    tryTranscriptFromMenu();
                    break;
                case 'done':
                    log("모든 작업 완료!");
                    clearInterval(scriptInterval);
                    scriptInterval = null;
                    if (actionTimeout) clearTimeout(actionTimeout);
                    break;
                case 'failed':
                    log("작업 실패.");
                    clearInterval(scriptInterval);
                    scriptInterval = null;
                    if (actionTimeout) clearTimeout(actionTimeout);
                    break;
            }
        }, CHECK_INTERVAL);
    }

    log("스크립트 초기화. 페이지 요소 로드를 기다립니다...");

    // YouTube의 SPA 네비게이션 감지
    window.addEventListener('yt-navigate-finish', function (event) {
        // URL이 실제로 /watch 페이지인지 확인 (다른 유튜브 페이지로 이동 시 불필요한 실행 방지)
        if (window.location.pathname === '/watch') {
            log("페이지 이동 감지 (yt-navigate-finish 이벤트 발생). 스크립트 재실행.");
            runMainLogic();
        } else {
            log(`페이지 이동 감지 (yt-navigate-finish): 현재 경로는 ${window.location.pathname}. /watch 페이지가 아니므로 스크립트를 실행하지 않습니다.`);
            if (scriptInterval) clearInterval(scriptInterval);
            if (actionTimeout) clearTimeout(actionTimeout);
        }
    });

    // 초기 페이지 로드 시 (만약 /watch 페이지라면)
    if (window.location.pathname === '/watch') {
        runMainLogic();
    } else {
        log(`초기 로드: 현재 경로는 ${window.location.pathname}. /watch 페이지가 아니므로 스크립트를 실행하지 않습니다.`);
    }

    // 사용자의 원래 @match 지시어가 googleusercontent.com 이었던 점을 고려:
    // 만약 해당 환경에서만 스크립트가 실행되어야 한다면, @match 를 원래대로 되돌리고
    // yt-navigate-finish 대신 다른 URL 변경 감지 메커니즘 (예: MutationObserver)을 고려해야 할 수 있습니다.
    // 하지만 일반적인 유튜브 사용 환경에서는 위의 @match와 yt-navigate-finish가 적절합니다.
})();