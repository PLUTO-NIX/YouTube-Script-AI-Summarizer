// background.js

// OpenAI API 엔드포인트 및 모델 설정
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
// 요구사항에 명시된 'o4-mini'가 정확한 모델 ID인지 확인이 필요합니다.
// OpenAI에서 제공하는 최신 모델 ID를 사용해야 합니다. (예: "o4-mini")
// 여기서는 "o4-mini"를 가정하고 사용합니다.
const DEFAULT_MODEL = 'o4-mini';

/**
 * content.js로부터 메시지를 수신하고 처리합니다.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 비동기 응답을 위해 true를 반환해야 합니다.
  if (request.action === 'summarizeTranscript') {
    console.log('백그라운드: summarizeTranscript 요청 수신');
    console.log('백그라운드: API Key 길이:', request.apiKey ? request.apiKey.length : '없음');
    console.log('백그라운드: 프롬프트:', request.prompt);
    // console.log('백그라운드: 스크립트 (일부):', request.transcript ? request.transcript.substring(0, 200) + '...' : '없음');
    console.log('백그라운드: 모델:', request.model || DEFAULT_MODEL);

    if (!request.apiKey) {
      console.error('백그라운드: API 키가 제공되지 않았습니다.');
      sendResponse({ success: false, error: 'API 키가 제공되지 않았습니다. 확장 프로그램 옵션에서 설정해주세요.' });
      return true; // 비동기 응답 처리 명시
    }
    if (!request.transcript) {
      console.error('백그라운드: 스크립트 내용이 없습니다.');
      sendResponse({ success: false, error: '요약할 스크립트 내용이 없습니다.' });
      return true; // 비동기 응답 처리 명시
    }

    // OpenAI API 호출
    callOpenAI(request.transcript, request.apiKey, request.prompt, request.model || DEFAULT_MODEL)
      .then(summary => {
        console.log('백그라운드: 요약 성공');
        sendResponse({ success: true, summary: summary });
      })
      .catch(error => {
        console.error('백그라운드: OpenAI API 호출 중 오류 발생:', error);
        sendResponse({ success: false, error: error.message || 'OpenAI API 처리 중 알 수 없는 오류 발생' });
      });

    return true; // 비동기 응라운드: 을 위해 true를 반환
  }
  // 다른 액션들을 위한 핸들러를 여기에 추가할 수 있습니다.
});

/**
 * OpenAI API를 호출하여 스크립트 요약을 요청합니다.
 * @param {string} transcript - 요약할 스크립트 텍스트
 * @param {string} apiKey - OpenAI API 키
 * @param {string} prompt - 사용자 정의 프롬프트
 * @param {string} model - 사용할 OpenAI 모델
 * @returns {Promise<string>} 요약된 텍스트
 */
async function callOpenAI(transcript, apiKey, userPrompt, model) {
  console.log(`백그라운드: OpenAI API 호출 시작. 모델: ${model}`);

  // API 요청 본문 구성
  // 사용자 프롬프트와 스크립트 내용을 조합합니다.
  const messages = [
    {
      role: 'system',
      content: 'You are a helpful assistant that summarizes YouTube video transcripts.'
    },
    {
      role: 'user',
      content: `${userPrompt}\n\nTranscript:\n${transcript}`
    }
  ];

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // JSON 파싱 실패 시 빈 객체 반환
      console.error('백그라운드: OpenAI API 오류 응답:', response.status, errorData);
      let errorMessage = `OpenAI API 오류: ${response.status}`;
      if (errorData.error && errorData.error.message) {
        errorMessage += ` - ${errorData.error.message}`;
      } else if (typeof errorData.detail === 'string') {
        errorMessage += ` - ${errorData.detail}`;
      }
      // API 키 오류에 대한 구체적인 메시지
      if (response.status === 401) {
        errorMessage = 'OpenAI API 키가 유효하지 않거나 인증에 실패했습니다. 확장 프로그램 옵션에서 API 키를 확인해주세요.';
      } else if (response.status === 429) {
        errorMessage = 'OpenAI API 요청 할당량이 초과되었습니다. 잠시 후 다시 시도하거나 사용량을 확인해주세요.';
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('백그라운드: OpenAI API 응답 수신');

    if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
      const summary = data.choices[0].message.content.trim();
      // console.log('백그라운드: 추출된 요약:', summary);
      return summary;
    } else {
      console.error('백그라운드: API 응답에서 요약 내용을 찾을 수 없습니다.', data);
      throw new Error('API 응답 형식이 올바르지 않거나 요약 내용이 없습니다.');
    }
  } catch (error) {
    console.error('백그라운드: fetch 또는 API 처리 중 예외 발생:', error);
    // 네트워크 오류와 API 자체 오류를 구분하여 메시지 전달
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인하거나 OpenAI API 서버 상태를 확인해주세요.');
    }
    throw error; // 이미 Error 객체이므로 그대로 throw
  }
}

// 확장 프로그램 설치 또는 업데이트 시 실행될 로직 (예: 기본 설정값 저장)
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('백그라운드: 확장 프로그램이 설치되었습니다.');
    // 필요한 경우 기본값 설정 (예: 기본 프롬프트)
    chrome.storage.local.get(['user_prompt'], (result) => {
      if (!result.user_prompt) {
        chrome.storage.local.set({ user_prompt: "다음 YouTube 스크립트 내용을 간결하게 요약해 주세요:" });
      }
    });
  } else if (details.reason === 'update') {
    console.log('백그라운드: 확장 프로그램이 업데이트되었습니다.');
  }
});

console.log('백그라운드 스크립트 (service_worker) 로드됨.');
