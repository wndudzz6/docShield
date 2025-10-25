package com.secureai.docshield.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReportResponse {
    private String summary;
    private List<String> risks;
    private List<String> recommendations;

    // 카테고리별 추가 필드는 자유롭게 JSON으로 받음
    private Map<String, Object> extra;
}
