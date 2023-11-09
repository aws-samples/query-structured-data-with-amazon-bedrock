// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.service.queryexecution;

import io.aws.bedrock.dataexploration.entity.DatabaseInformation;
import io.aws.bedrock.dataexploration.entity.QueryResult;
import org.springframework.stereotype.Service;
import com.simba.athena.jdbc.Driver;

import java.sql.*;
import java.util.LinkedList;
import java.util.Properties;

@Service
public class AthenaQueryExecutor implements QueryExecutor {

    @Override
    public QueryResult executeQuery(DatabaseInformation databaseInformation, String queryString)
            throws ClassNotFoundException {
        // Load the driver so it'll be found by JDBC:
        Class.forName("com.simba.athena.jdbc.Driver");
        Connection connection = null;
        Statement statement = null;
        // jdbc:awsathena://AwsRegion=us-east-1;AwsCredentialsProviderClass=com.simba.athena.amazonaws.auth.DefaultAWSCredentialsProviderChain;
        try {
            String url = databaseInformation.getConnectionUrl();
            connection = DriverManager.getConnection(url);
            statement = connection.createStatement();
            try (ResultSet rs = statement.executeQuery(queryString)) {
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
        } finally {
            try {
                if (statement != null)
                    statement.close();
            } catch (Exception ex) {
                ex.printStackTrace();
            }
            try {
                if (connection != null)
                    connection.close();
            } catch (Exception ex) {
                ex.printStackTrace();
            }
        }
    }
}
