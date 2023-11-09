// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * Generic typings for CloudFormation custom resource request/responses
 *
 * Use CustomResourceProviderRequest and CustomResourceEventResult, parameterized with your custom
 * resource's input properties and output attributes, respectively.
 */

interface CustomResourceProviderRequestBase<TResProps extends object> {
  RequestType: string;
  LogicalResourceId: string;
  ResourceProperties: TResProps;
  ResourceType: string;
  RequestId: string;
  StackId: string;
}

export interface CustomResourceProviderCreateRequest<TResProps extends object>
  extends CustomResourceProviderRequestBase<TResProps> {
  RequestType: "Create";
}

export interface CustomResourceProviderUpdateRequest<TResProps extends object>
  extends CustomResourceProviderRequestBase<TResProps> {
  RequestType: "Update";
  PhysicalResourceId: string;
  OldResourceProperties: TResProps;
}

export interface CustomResourceProviderDeleteRequest<TResProps extends object>
  extends CustomResourceProviderRequestBase<TResProps> {
  RequestType: "Delete";
  PhysicalResourceId: string;
}

/**
 * Generic type for Custom Resource Provider function requests (create/update/delete events)
 */
export type CustomResourceProviderRequest<TResProps extends object> =
  | CustomResourceProviderCreateRequest<TResProps>
  | CustomResourceProviderUpdateRequest<TResProps>
  | CustomResourceProviderDeleteRequest<TResProps>;

/**
 * Generic type for Custom Resource Provider results (including final GetAtt-able data)
 */
export interface CustomResourceEventResult<TResAttrs extends object> {
  PhysicalResourceId?: string;
  Data?: TResAttrs;
  NoEcho?: boolean;
}
