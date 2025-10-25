package com.secureai.docshield.domain;

public enum DocumentType {

    HR_INFO("인사 정보"),
    BUSINESS_INFO("사업 관련 정보 "),
    TECH_INFO("기술 정보"),
    PUBLIC_INFO("공개 정보"),
    PERSONAL_INFO("개인 정보 )");

    private final String description;

    DocumentType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
