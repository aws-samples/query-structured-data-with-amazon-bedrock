// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.service;

import java.nio.charset.Charset;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import io.aws.bedrock.dataexploration.entity.BedrockResult;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

@Service
public class BedrockService {
    private final ObjectMapper objectMapper = new ObjectMapper();

    public BedrockResult callBedrock(String prompt) throws JsonProcessingException {
        BedrockRuntimeClient bedrockRuntimeClient = BedrockRuntimeClient.builder().build();
        ObjectNode bedrockBody = createBedrockBody(prompt);
        InvokeModelRequest request = InvokeModelRequest.builder()
                .modelId("anthropic.claude-v2")
                .body(SdkBytes.fromString(bedrockBody.toString(), Charset.defaultCharset()))
                .build();
        InvokeModelResponse invokeModel = bedrockRuntimeClient.invokeModel(request);

        return extractBedrockResult(invokeModel);
    }

    private BedrockResult extractBedrockResult(InvokeModelResponse invokeModel) {
        String bedrockResponse = invokeModel.body().asUtf8String();
        int startSql = bedrockResponse.indexOf("<query>");
        int endSql = bedrockResponse.indexOf("</query>");
        int startExplanation = bedrockResponse.indexOf("<explanation>");
        int endExplanation = bedrockResponse.indexOf("</explanation>");
        String sql = bedrockResponse.substring(startSql + "<query>".length(), endSql).replaceAll("\\\\n", " ")
                .replaceAll("\n", " ").replaceAll("\\\\\"", "\"");
        String explanation = bedrockResponse.substring(startExplanation + "<explanation>".length(), endExplanation)
                .replaceAll("\\\\n", " ").replaceAll("\n", " ").replaceAll("\\\\\"", "\"");
        return new BedrockResult(explanation, sql);
    }

    private ObjectNode createBedrockBody(String prompt) {
        ObjectNode objectNode = objectMapper.createObjectNode();
        objectNode.put("prompt", prompt);
        objectNode.put("max_tokens_to_sample", 512);
        objectNode.put("temperature", 0);
        objectNode.put("top_k", 250);
        objectNode.put("top_p", 1);
        ArrayNode stopSequences = objectMapper.createArrayNode();
        stopSequences.add("\\nHuman:");
        objectNode.set("stop_sequences", stopSequences);
        return objectNode;
    }

}
