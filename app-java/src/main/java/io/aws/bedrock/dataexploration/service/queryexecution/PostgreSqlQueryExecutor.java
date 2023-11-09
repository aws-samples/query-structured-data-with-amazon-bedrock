// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.service.queryexecution;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.aws.bedrock.dataexploration.entity.DatabaseInformation;
import io.aws.bedrock.dataexploration.entity.QueryResult;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;
import software.amazon.awssdk.services.secretsmanager.model.SecretsManagerException;

import java.sql.*;
import java.util.LinkedList;
import java.util.Properties;

@Service
public class PostgreSqlQueryExecutor implements QueryExecutor {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public QueryResult executeQuery(DatabaseInformation databaseInformation, String queryString) {
        JsonNode secretValue = getSecretValue(databaseInformation);
        String url = databaseInformation.getConnectionUrl();
        Properties props = new Properties();
        props.setProperty("user", secretValue.get("username").textValue());
        props.setProperty("password", secretValue.get("password").textValue());
        Statement st;
        try (Connection conn = DriverManager.getConnection(url, props)) {
            st = conn.createStatement();
            try (ResultSet rs = st.executeQuery(queryString)) {
                LinkedList<String> columnNames = new LinkedList<>();
                int columnCount = rs.getMetaData().getColumnCount();
                for (int i = 1; i <= columnCount; i++) {
                    columnNames.add(rs.getMetaData().getColumnLabel(i));
                }
                LinkedList<LinkedList<String>> values = new LinkedList<>();
                while (rs.next()) {
                    LinkedList<String> rowValues = new LinkedList<>();
                    for (int i = 1; i <= columnCount; i++) {
                        rowValues.add(rs.getString(i));
                    }
                    values.add(rowValues);
                }
                return new QueryResult(values, columnNames);
            }
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    private JsonNode getSecretValue(DatabaseInformation databaseInformation) {
        try (SecretsManagerClient secretsClient = SecretsManagerClient.builder().build()) {
            GetSecretValueRequest valueRequest = GetSecretValueRequest.builder()
                    .secretId(databaseInformation.getDatabaseCredentialsSsm())
                    .build();
            GetSecretValueResponse valueResponse = secretsClient.getSecretValue(valueRequest);
            String secret = valueResponse.secretString();
            return objectMapper.readTree(secret);
        } catch (SecretsManagerException e) {
            System.err.println(e.awsErrorDetails().errorMessage());
            throw new RuntimeException(e);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
