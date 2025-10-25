package com.secureai.docshield.service;

import com.secureai.docshield.domain.DocumentType;
import org.springframework.stereotype.Service;

@Service
public class PromptFactoryService {

    public String buildSystemPrompt(DocumentType type) {
        return switch (type) {
            case HR_INFO -> "이 문서는 인사 관련 문서야. 사용자의 질문에 명확히 답해.";
            case BUSINESS_INFO -> "이 문서는 사업 관련 문서야. 전략과 요약 중심으로 설명해.";
            case TECH_INFO -> "이 문서는 기술 문서야. 시스템 구조나 기술 포인트를 중심으로 요약해.";
            case PERSONAL_INFO -> "이 문서는 개인 문서야. 개인정보는 이미 처리되었으니 내용 중심으로 답해.";
            case PUBLIC_INFO -> "이 문서는 공개 문서야. 핵심 메시지만 명확히 요약해.";
        };
    }

}

