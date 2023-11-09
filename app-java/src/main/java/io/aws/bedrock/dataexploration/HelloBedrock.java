// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration;

import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

import java.nio.charset.Charset;

public class HelloBedrock {

    private static final String BEDROCK_JSON_BODY = """
            {
                "prompt": "##PROMPT##",
                "max_tokens_to_sample": 512,
                "temperature": 0,
                "top_k": 250,
                "top_p": 1,
                "stop_sequences": [
                    "\\nHuman:"
                ]
            }
            """;

    public static void main(String[] args) {
        if (args == null || args.length == 0) {
            System.out.println("Please provide a prompt as argument");
            return;
        }
        try (BedrockRuntimeClient bedrockClient = BedrockRuntimeClient.builder().build()) {
            InvokeModelResponse invokeModel = bedrockClient
                    .invokeModel(InvokeModelRequest.builder()
                            .modelId("anthropic.claude-v1")
                            .body(SdkBytes.fromString(BEDROCK_JSON_BODY.replace("##PROMPT##", args[0]),
                                    Charset.defaultCharset()))
                            .build());
            System.out.println("invokeModel body: " + invokeModel.body().asUtf8String());

        }
    }
}
