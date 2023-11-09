// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.controller;

import io.aws.bedrock.dataexploration.entity.QueryResult;
import io.aws.bedrock.dataexploration.service.BedrockService;
import io.aws.bedrock.dataexploration.service.DynamoDbService;
import io.aws.bedrock.dataexploration.service.UserQueryExecutionService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.servlet.ModelAndView;

import java.util.Map;

@Controller
@RequestMapping("/")
public class UserQuestionController {

    private static final Logger LOGGER = LoggerFactory.getLogger(UserQuestionController.class);
    private final DynamoDbService dynamoDbService;
    private final UserQueryExecutionService userQueryExecutionService;
;

    public UserQuestionController(DynamoDbService dynamoDbService, UserQueryExecutionService userQueryExecutionService) {
        this.dynamoDbService = dynamoDbService;
        this.userQueryExecutionService = userQueryExecutionService;
    }

    @GetMapping
    public String userQuestionView(Model model) {
        model.addAttribute("databases", dynamoDbService.getDatabaseItems());
        return "userQuestion";
    }

    @PostMapping
    public String userQuestionSubmitted(HttpServletRequest httpServletRequest, Model model) throws ClassNotFoundException {
        Map<String, String[]> parameterMap = httpServletRequest.getParameterMap();
        String databaseName = parameterMap.get("databaseName")[0];
        String userQuestion = parameterMap.get("userQuestion")[0];
        QueryResult queryResult = userQueryExecutionService.executeQuery(databaseName, userQuestion);
        model.addAttribute("queryResult", queryResult);
        model.addAttribute("userQuestion", userQuestion);
        return "questionResult";
    }

    @GetMapping("/test")
    public QueryResult test(Model model) throws ClassNotFoundException {
        return userQueryExecutionService.executeQuery("neptune", "Which movie launched Angelina Jolies career?");
    }

    @ExceptionHandler(Exception.class)
    public ModelAndView handleError(HttpServletRequest req, Exception ex) {
        LOGGER.error("Error during request: " + req.getRequestURL(), ex);
        ModelAndView mav = new ModelAndView();
        mav.addObject("exceptionMessage", ex.getMessage());
        mav.setViewName("error");
        return mav;
    }

}
